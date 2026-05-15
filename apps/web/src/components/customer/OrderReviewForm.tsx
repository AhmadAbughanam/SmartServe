"use client";

import { useState } from "react";
import { post } from "../../lib/api";
import type { Order } from "../../lib/types";

const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const COPPER_INK = "#7c5511";

const ISSUE_TAGS = [
  { value: "COLD", label: "Cold food" },
  { value: "LATE", label: "Late" },
  { value: "WRONG_ITEM", label: "Wrong item" },
  { value: "TASTE", label: "Taste issue" },
  { value: "OTHER", label: "Other" },
];

function Stars({
  label,
  value,
  onChange,
  size = 26,
}: {
  label: string;
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}) {
  return (
    <div className="flex gap-1.5" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${label}: ${star} stars`}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill={star <= value ? "#f59e0b" : "none"} stroke={star <= value ? "#f59e0b" : "var(--ink-300)"} strokeWidth={1.5}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function OrderReviewForm({
  order,
  sessionId,
  onSubmitted,
}: {
  order: Order;
  sessionId: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating === 0) return;
    setLoading(true);
    setError(null);
    try {
      await post(`/api/sessions/${sessionId}/orders/${order.id}/reviews`, {
        overallRating: rating,
        comment: comment || undefined,
        issueTags: tags.size > 0 ? Array.from(tags) : undefined,
        itemReviews: order.orderItems
          .map((item) => ({
            menuItemId: item.menuItemId,
            rating: itemRatings[item.menuItemId] ?? 0,
          }))
          .filter((item) => item.rating > 0),
      });
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="order-review-form" className="rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Rate your experience</div>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-500)" }}>Your feedback helps the kitchen and service team improve.</p>

      <div className="mt-3">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Overall order</div>
        <Stars label="Overall order rating" value={rating} onChange={setRating} />
      </div>

      {rating > 0 && rating <= 3 && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold" style={{ color: "var(--ink-500)" }}>What went wrong?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ISSUE_TAGS.map((tag) => {
              const active = tags.has(tag.value);
              return (
                <button
                  key={tag.value}
                  type="button"
                  onClick={() => {
                    const next = new Set(tags);
                    if (next.has(tag.value)) next.delete(tag.value);
                    else next.add(tag.value);
                    setTags(next);
                  }}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                  style={{
                    background: active ? "var(--bad-soft)" : "var(--ink-0)",
                    color: active ? "var(--bad)" : "var(--ink-500)",
                    border: `1px solid ${active ? "#fecaca" : "var(--ink-200)"}`,
                  }}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rating > 0 && (
        <>
          <div className="mt-4 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Rate items</div>
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{item.menuItem?.name ?? "Item"}</div>
                  <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>Optional item rating</div>
                </div>
                <Stars
                  label={`${item.menuItem?.name ?? "Item"} rating`}
                  value={itemRatings[item.menuItemId] ?? 0}
                  onChange={(nextRating) => setItemRatings((current) => ({ ...current, [item.menuItemId]: nextRating }))}
                  size={20}
                />
              </div>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Any additional feedback? (optional)"
            rows={2}
            className="mt-3 w-full rounded-[10px] px-3 py-2 text-[12px] outline-none"
            style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
          />
        </>
      )}

      {error && <p className="mt-2 text-[10px]" style={{ color: "var(--bad)" }}>{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={loading || rating === 0}
        className="mt-3 w-full rounded-[12px] py-2.5 text-[12px] font-semibold text-white transition disabled:opacity-50"
        style={{ background: rating > 0 ? COPPER : COPPER_EDGE, color: rating > 0 ? "#fff" : COPPER_INK }}
      >
        {loading ? "Submitting..." : "Submit Review"}
      </button>
    </div>
  );
}
