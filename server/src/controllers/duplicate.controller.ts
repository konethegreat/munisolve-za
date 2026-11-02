import type { Request, RequestHandler } from 'express';
import {
  confirmDuplicate as confirmDuplicateService,
  dismissDuplicate as dismissDuplicateService,
  listDuplicates,
  unmergeReport as unmergeReportService,
} from '../services/duplicate.service';

function actor(req: Request) {
  return { id: req.user!.id, role: req.user!.role };
}

function eventContext(req: Request) {
  return {
    requestId: String(req.id),
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };
}

export const getDuplicates: RequestHandler = async (req, res) => {
  const data = await listDuplicates(req.validated.params.id, actor(req));
  res.status(200).json({ success: true, data, count: data.length });
};

export const confirmDuplicate: RequestHandler = async (req, res) => {
  const result = await confirmDuplicateService({
    reportId: req.validated.params.id,
    candidateId: req.validated.params.candidateId,
    actor: actor(req),
    ...eventContext(req),
  });

  res.status(200).json({
    success: true,
    message: `Report merged into #${result.canonical.id}`,
    data: result.report,
    canonical: result.canonical,
  });
};

export const dismissDuplicate: RequestHandler = async (req, res) => {
  const data = await dismissDuplicateService({
    reportId: req.validated.params.id,
    candidateId: req.validated.params.candidateId,
    actor: actor(req),
    ...eventContext(req),
  });

  res.status(200).json({ success: true, message: 'Reports kept separate', data });
};

export const unmergeReport: RequestHandler = async (req, res) => {
  const data = await unmergeReportService({
    reportId: req.validated.params.id,
    actor: actor(req),
    ...eventContext(req),
  });

  res.status(200).json({ success: true, message: 'Duplicate link undone', data });
};
