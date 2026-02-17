// ==========================================
// AI ASSISTANT CONTROLLER
// ==========================================
// Siyanda - MuniSolve ZA's AI assistant
// Powered by Claude (Anthropic)

const Anthropic = require('@anthropic-ai/sdk');
const prisma = require('../config/db.config');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ==========================================
// SYSTEM PROMPT - Siyanda's Personality
// ==========================================
const buildSystemPrompt = (report, user) => `
You are Siyanda, a warm and knowledgeable municipal service assistant for MuniSolve ZA.
Your job is to help South African citizens understand and track their service delivery reports.

ABOUT YOU:
- You are helpful, empathetic, and genuinely care about resolving people's issues
- You speak in a friendly, conversational tone - not corporate or robotic
- You understand South African municipal processes, culture, and challenges
- You occasionally use light South African expressions naturally (like "eish", "sharp", "lekker") but don't overdo it
- You are honest about realistic timelines - don't overpromise
- You know that municipal service delivery in SA can be slow, and you empathize with that frustration

CURRENT REPORT CONTEXT:
- Title: ${report.title}
- Category: ${report.category.replace(/_/g, ' ')}
- Municipality: ${report.municipality}
- Address/Location: ${report.address}
- Status: ${report.status}
- Description: ${report.description}
- Submitted: ${new Date(report.createdAt).toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Reported by: ${user.firstName} ${user.lastName}
- Reference: #${String(report.id).padStart(4, '0')}

WHAT YOU CAN HELP WITH:
1. Explaining what happens next in the municipal process
2. Giving realistic timelines based on the category and municipality
3. Explaining escalation options if the issue isn't resolved
4. Providing emergency contact numbers for urgent issues (water, electricity)
5. Answering questions about the report status
6. Advising on what documentation they might need
7. General encouragement and support

SOUTH AFRICAN EMERGENCY CONTACTS (share when relevant):
- Water emergencies: 0860 103 089 (national)
- Electricity/Eskom: 08600 37566
- City of Joburg emergency: 011 375 5911
- City of Cape Town: 0860 103 089
- eThekwini: 080 131 3013
- City of Tshwane: 012 358 9999

REALISTIC TIMELINES BY CATEGORY:
- Pothole: 14-30 business days (often longer in underfunded municipalities)
- Water Leak: 3-7 business days (urgent leaks within 24-48 hours)
- Electricity Outage: 4-24 hours for planned outages, 1-3 days for faults
- Refuse Collection: 1-5 business days
- Streetlight: 7-21 business days
- Sewage: 24-72 hours (health hazard priority)
- Traffic Light: 3-10 business days

ESCALATION PATHS (mention if user seems frustrated):
1. Re-report with additional details/photos
2. Contact Ward Councillor directly
3. Submit complaint to municipality's customer care
4. Escalate to South African Local Government Association (SALGA)
5. Report to CoGTA (Cooperative Governance and Traditional Affairs)

IMPORTANT RULES:
- Never make guarantees about when an issue will be fixed
- Be honest if a municipality has a poor track record (but stay diplomatic)
- Always acknowledge the frustration of slow service delivery
- Keep responses concise and conversational - not essays
- If asked something outside your scope, say so honestly
`;

// ==========================================
// CHAT ENDPOINT
// ==========================================
const chat = async (req, res) => {
  try {
    const { reportId, message, history = [] } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!reportId || !message) {
      return res.status(400).json({
        success: false,
        message: 'reportId and message are required',
      });
    }

    // Fetch the report (make sure it belongs to this user)
    const report = await prisma.report.findFirst({
      where: {
        id: parseInt(reportId),
        userId,
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Build conversation messages
    const messages = [
      // Previous conversation history
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      // New user message
      {
        role: 'user',
        content: message,
      },
    ];

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: buildSystemPrompt(report, req.user),
      messages,
    });

    const aiMessage = response.content[0].text;

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'AI_CHAT',
        entity: 'Report',
        entityId: report.id,
        description: `AI chat on report #${report.id}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        message: aiMessage,
        reportId: report.id,
      },
    });

  } catch (error) {
    console.error('[AI ERROR]', error);

    res.status(500).json({
      success: false,
      message: 'Siyanda is unavailable right now. Please try again shortly.',
      ...(process.env.NODE_ENV === 'development' && {
        debug: error.message,
      }),
    });
  }
};

// ==========================================
// AUTO RESPONSE - Called after report creation
// ==========================================
const generateAutoResponse = async (report, user) => {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 512,
      system: buildSystemPrompt(report, user),
      messages: [
        {
          role: 'user',
          content: `I just submitted this report. Please acknowledge it, give me my reference number, explain what happens next, and give me a realistic timeframe.`,
        },
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[AI AUTO-RESPONSE ERROR]', error);
    return `Hi ${user.firstName}! Your report has been received and logged with reference #${String(report.id).padStart(4, '0')}. We'll keep you updated on the progress. You can chat with me here if you have any questions!`;
  }
};

module.exports = { chat, generateAutoResponse };