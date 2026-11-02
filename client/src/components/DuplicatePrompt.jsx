import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CopyX, GitMerge, Loader2, MapPin } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { normalizeApiError } from '../api/errors';
import StatusBadge from './StatusBadge';

function isSuggested(item) {
  return (item?.status ?? 'SUGGESTED') === 'SUGGESTED';
}

function timeAgo(value) {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function scoreLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}% match`;
}

export default function DuplicatePrompt({
  reportId,
  initialDuplicates = null,
  autoFetch = true,
  onMerged,
  onChanged,
  className = '',
}) {
  const toast = useToast();
  const [items, setItems] = useState(() => (initialDuplicates ?? []).filter(isSuggested));
  const [loading, setLoading] = useState(autoFetch && initialDuplicates == null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!autoFetch) return undefined;

    let active = true;
    setLoading(true);
    setError('');
    api
      .get(`/reports/${reportId}/duplicates`)
      .then(({ data }) => {
        if (active && data?.success) setItems((data.data ?? []).filter(isSuggested));
      })
      .catch((err) => {
        if (active) setError(normalizeApiError(err, 'Could not check for duplicates.').message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reportId, autoFetch]);

  const removeItem = (item) => {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    onChanged?.();
  };

  const handleConfirm = async (item) => {
    const candidateId = item.candidate?.id;
    if (!candidateId) return;

    setBusyId(item.id);
    setError('');
    try {
      const { data } = await api.post(
        `/reports/${reportId}/duplicates/${candidateId}/confirm`,
      );
      setItems([]);
      toast.success(
        `Merged into report #${String(candidateId).padStart(4, '0')}. You can follow progress there.`,
      );
      onMerged?.(data?.data ?? null, data?.canonical ?? null);
    } catch (err) {
      const apiError = normalizeApiError(err, 'Could not merge these reports.');
      setError(apiError.message);
      toast.error(apiError);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (item) => {
    const candidateId = item.candidate?.id;
    if (!candidateId) return;

    setBusyId(item.id);
    setError('');
    try {
      await api.post(`/reports/${reportId}/duplicates/${candidateId}/dismiss`);
      removeItem(item);
      toast.info('Kept as separate reports. Thanks for checking.');
    } catch (err) {
      const apiError = normalizeApiError(err, 'Could not update this suggestion.');
      setError(apiError.message);
      toast.error(apiError);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 ${className}`}>
        <Loader2 size={16} className="animate-spin" />
        Checking for similar reports…
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <section
      className={`rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm ${className}`}
      aria-labelledby="duplicate-heading"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
          <GitMerge size={18} />
        </span>
        <div className="min-w-0">
          <h2 id="duplicate-heading" className="font-semibold text-slate-800">
            Possible duplicate
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            We found a similar open report nearby. Merging keeps updates and photos in one
            place. Keep it separate if it is a different issue.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const candidate = item.candidate ?? {};
          const busy = busyId === item.id;
          const match = scoreLabel(item.score);
          return (
            <li key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link
                    to={`/reports/${candidate.id}`}
                    className="font-medium text-[#0d3b5c] hover:underline"
                  >
                    {candidate.title || `Report #${candidate.id}`}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {candidate.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} />
                        <span className="line-clamp-1">{candidate.address}</span>
                      </span>
                    )}
                    {candidate.createdAt && <span>{timeAgo(candidate.createdAt)}</span>}
                    {match && <span className="font-semibold text-amber-700">{match}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={candidate.status} />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleDismiss(item)}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <CopyX size={14} /> Keep separate
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm(item)}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0d3b5c] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0a2d45] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Same issue
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
