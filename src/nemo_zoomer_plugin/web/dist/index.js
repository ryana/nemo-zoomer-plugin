// SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
import { Badge as e, Button as t, Flex as n, ProgressBar as r, SidePanel as i, Spinner as a, Stack as o, Text as s } from "@nvidia/foundations-react-core";
import { createElement as c, forwardRef as l, useCallback as u, useEffect as d, useMemo as f, useRef as p, useState as m } from "react";
import { useMutation as h, useQuery as g, useQueryClient as _ } from "@tanstack/react-query";
import { AssistantChat as v } from "@nemo/common";
import { Fragment as y, jsx as b, jsxs as x } from "react/jsx-runtime";
//#region node_modules/.pnpm/lucide-react@0.468.0_react@19.2.8/node_modules/lucide-react/dist/esm/shared/src/utils.js
var S = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), C = (...e) => e.filter((e, t, n) => !!e && e.trim() !== "" && n.indexOf(e) === t).join(" ").trim(), w = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
}, T = l(({ color: e = "currentColor", size: t = 24, strokeWidth: n = 2, absoluteStrokeWidth: r, className: i = "", children: a, iconNode: o, ...s }, l) => c("svg", {
	ref: l,
	...w,
	width: t,
	height: t,
	stroke: e,
	strokeWidth: r ? Number(n) * 24 / Number(t) : n,
	className: C("lucide", i),
	...s
}, [...o.map(([e, t]) => c(e, t)), ...Array.isArray(a) ? a : [a]])), E = (e, t) => {
	let n = l(({ className: n, ...r }, i) => c(T, {
		ref: i,
		iconNode: t,
		className: C(`lucide-${S(e)}`, n),
		...r
	}));
	return n.displayName = `${e}`, n;
}, ee = E("ChevronDown", [["path", {
	d: "m6 9 6 6 6-6",
	key: "qrunsl"
}]]), te = E("ChevronRight", [["path", {
	d: "m9 18 6-6-6-6",
	key: "mthhwq"
}]]), D = E("CircleCheck", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}], ["path", {
	d: "m9 12 2 2 4-4",
	key: "dzmm74"
}]]), O = E("GitBranch", [
	["line", {
		x1: "6",
		x2: "6",
		y1: "3",
		y2: "15",
		key: "17qcm7"
	}],
	["circle", {
		cx: "18",
		cy: "6",
		r: "3",
		key: "1h7g24"
	}],
	["circle", {
		cx: "6",
		cy: "18",
		r: "3",
		key: "fqmcym"
	}],
	["path", {
		d: "M18 9a9 9 0 0 1-9 9",
		key: "n2h4wq"
	}]
]), k = E("MessageCircleQuestion", [
	["path", {
		d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
		key: "vv11sd"
	}],
	["path", {
		d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",
		key: "1u773s"
	}],
	["path", {
		d: "M12 17h.01",
		key: "p32p05"
	}]
]), A = E("RotateCcw", [["path", {
	d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",
	key: "1357e3"
}], ["path", {
	d: "M3 3v5h5",
	key: "1xhq8a"
}]]), j = E("Sparkles", [
	["path", {
		d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
		key: "4pj2yx"
	}],
	["path", {
		d: "M20 3v4",
		key: "1olli1"
	}],
	["path", {
		d: "M22 5h-4",
		key: "1gvqau"
	}],
	["path", {
		d: "M4 17v2",
		key: "vumght"
	}],
	["path", {
		d: "M5 18H3",
		key: "zchphs"
	}]
]), M = E("TriangleAlert", [
	["path", {
		d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
		key: "wmoenq"
	}],
	["path", {
		d: "M12 9v4",
		key: "juzpu7"
	}],
	["path", {
		d: "M12 17h.01",
		key: "p32p05"
	}]
]), N = /* @__PURE__ */ new Set(["queued", "running"]), P = /* @__PURE__ */ new Set([
	"not_started",
	"queued",
	"running",
	"ready",
	"failed"
]), F = (e) => typeof e == "object" && !!e, I = (e) => typeof e == "string" || e === null, L = (e) => !F(e) || typeof e.id != "string" || typeof e.kind != "string" || typeof e.title != "string" || typeof e.what != "string" || !I(e.why) || !I(e.result) || !Array.isArray(e.problems) || !e.problems.every((e) => typeof e == "string") || !Array.isArray(e.span_ids) || !e.span_ids.every((e) => typeof e == "string") || !F(e.metrics) || !Object.values(e.metrics).every((e) => typeof e == "number" || typeof e == "string") || !Array.isArray(e.children) ? !1 : e.children.every(L), ne = (e) => F(e) && typeof e.workspace == "string" && typeof e.trace_id == "string" && typeof e.status == "string" && P.has(e.status) && typeof e.progress == "number" && e.progress >= 0 && e.progress <= 100 && typeof e.stage == "string" && typeof e.message == "string" && I(e.error) && I(e.trace_name) && (e.hierarchy === null || L(e.hierarchy)) && I(e.updated_at), R = (e) => e !== void 0 && N.has(e.status), z = (e, t) => `/apis/zoomer/v1/workspaces/${encodeURIComponent(e)}/traces/${encodeURIComponent(t)}`, B = (e, t, n) => new URL(`${z(e, t)}/nodes/${encodeURIComponent(n)}/-/v1`, window.location.origin).toString(), V = (e, t) => [
	"plugin",
	"zoomer",
	"generation",
	e,
	t
], H = async (e) => {
	let t = `${e.status} ${e.statusText}`.trim();
	try {
		let n = await e.json();
		F(n) && typeof n.detail == "string" && (t = n.detail);
	} catch {}
	return Error(t || "The Zoomer request failed.");
}, U = async (e, t, n, r = !1) => {
	let i = `${z(e.workspaceId, t.id)}${n === "POST" ? "/generation" : ""}${r ? "?regenerate=true" : ""}`, a = e.auth.getAccessToken(), o = await fetch(i, {
		method: n,
		headers: a ? { Authorization: `Bearer ${a}` } : void 0
	});
	if (!o.ok) throw await H(o);
	let s = await o.json();
	if (!ne(s)) throw Error("Zoomer returned an invalid generation response.");
	return s;
}, W = (e, t) => g({
	queryKey: V(e.workspaceId, t.id),
	queryFn: () => U(e, t, "GET"),
	refetchInterval: (e) => R(e.state.data) ? 1e3 : !1
}), G = (e, t) => {
	let n = _();
	return h({
		mutationFn: (n) => U(e, t, "POST", n),
		onSuccess: (r) => {
			n.setQueryData(V(e.workspaceId, t.id), r);
		}
	});
}, K = [
	"What happened in this section?",
	"Why did the agent do this?",
	"Were there any failures or recoveries?"
], q = (e) => e.length <= 56 ? e : `${e.slice(0, 55)}…`, J = (e) => {
	let t = q(e.title);
	return e.kind === "model" ? [
		`What did the model produce in “${t}”?`,
		"What trace evidence led to this model response?",
		"Was this response consistent with the surrounding trace?"
	] : e.kind === "tool" ? [
		`What tool activity happened in “${t}”?`,
		"Which tool inputs and outputs mattered here?",
		"Did this tool call fail or require recovery?"
	] : e.kind === "summary" ? [
		`What happened in “${t}”?`,
		"Why was this section necessary?",
		"What failures or recoveries occurred here?"
	] : K;
}, Y = (e) => {
	if (!e?.startsWith("#zoomer-node=")) return null;
	try {
		return decodeURIComponent(e.slice(13)) || null;
	} catch {
		return null;
	}
}, X = (e) => `zoomer-node-${encodeURIComponent(e).replaceAll("%", "_")}`, re = (e, t) => {
	let n = [], r = e.get(t);
	for (; r;) n.unshift(r), r = e.get(r);
	return n;
}, ie = ({ href: e, children: t }) => Y(e ?? null) ? /* @__PURE__ */ b("a", {
	href: e,
	className: "cursor-pointer text-brand underline underline-offset-2",
	children: t
}) : /* @__PURE__ */ b("span", { children: t }), ae = ({ baseURL: r, open: c, target: l, onClose: u, onCitation: f }) => {
	let [h, g] = m(!1), _ = p(null);
	d(() => g(!1), [l.node.id]);
	let y = (e) => {
		if (!(e.target instanceof Element)) return;
		let t = Y(e.target.closest("a")?.getAttribute("href") ?? null);
		t && (e.preventDefault(), f(t));
	}, S = (e) => {
		let t = _.current?.querySelector("textarea[aria-label=\"Task prompt\"]");
		t && ((Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set)?.call(t, e), t.dispatchEvent(new Event("input", { bubbles: !0 })), t.focus());
	}, C = J(l.node);
	return /* @__PURE__ */ b(i, {
		bordered: !0,
		closeOnClickOutside: !1,
		className: "w-full",
		style: { maxWidth: 560 },
		forceMount: !0,
		modal: !1,
		open: c,
		side: "right",
		slotHeading: /* @__PURE__ */ x(o, {
			gap: "density-xs",
			className: "min-w-0 pr-density-xl",
			children: [/* @__PURE__ */ b(s, {
				kind: "label/bold/lg",
				children: "Ask Zoomer"
			}), /* @__PURE__ */ b(s, {
				kind: "body/regular/sm",
				className: "truncate text-secondary",
				title: l.node.title,
				children: l.node.title
			})]
		}),
		slotNavigation: /* @__PURE__ */ x(o, {
			gap: "density-xs",
			className: "min-w-0",
			children: [
				/* @__PURE__ */ x(e, {
					color: "green",
					kind: "outline",
					children: ["Focused on ", l.node.kind]
				}),
				/* @__PURE__ */ b(s, {
					kind: "label/regular/sm",
					className: "truncate text-secondary",
					title: l.breadcrumb.join(" / "),
					children: l.breadcrumb.join(" / ")
				}),
				h ? /* @__PURE__ */ x(n, {
					align: "center",
					gap: "density-xs",
					children: [/* @__PURE__ */ b(a, {
						size: "small",
						"aria-label": "Zoomer is inspecting the trace"
					}), /* @__PURE__ */ b(s, {
						kind: "label/regular/sm",
						className: "text-secondary",
						children: "Inspecting trace and answering…"
					})]
				}) : null
			]
		}),
		onOpenChange: (e) => {
			e || u();
		},
		children: /* @__PURE__ */ b("div", {
			ref: _,
			className: "h-full min-h-0",
			onClickCapture: y,
			"data-testid": "zoomer-question-panel-content",
			children: /* @__PURE__ */ b(v, {
				model: "zoomer-context",
				baseURL: r,
				assistantName: "Zoomer",
				placeholder: "Ask about this part of the trace",
				emptyState: {
					slotHeading: "Ask about this section",
					slotSubheading: "Zoomer will focus here and inspect the rest of the trace when the answer needs more context."
				},
				messageContentProps: { markdownLinkComponent: ie },
				onRunningChange: g,
				enableImageAttachments: !1,
				slotComposerStart: /* @__PURE__ */ b(n, {
					gap: "density-xs",
					className: "min-w-0 flex-wrap",
					children: C.map((e) => /* @__PURE__ */ b(t, {
						kind: "tertiary",
						size: "small",
						onClick: () => S(e),
						children: e
					}, e))
				}),
				className: "h-full"
			}, l.node.id)
		})
	});
}, Z = (e) => e instanceof Error ? e.message : "The Zoomer request failed.", oe = (e) => e === "summary" ? "green" : e === "model" ? "purple" : e === "tool" ? "blue" : "gray", se = (e, t) => e === "duration_ms" && typeof t == "number" ? `${t.toLocaleString()} ms` : e === "total_tokens" ? `${Number(t).toLocaleString()} tokens` : e === "spans" ? `${Number(t).toLocaleString()} span${Number(t) === 1 ? "" : "s"}` : e === "events" ? `${Number(t).toLocaleString()} event${Number(t) === 1 ? "" : "s"}` : e === "semantic_phases" ? `${Number(t).toLocaleString()} phase${Number(t) === 1 ? "" : "s"}` : `${e.replaceAll("_", " ")} · ${t}`, ce = (e) => {
	let t = /* @__PURE__ */ new Set(), n = (e, r) => {
		r < 2 && t.add(e.id), e.children.forEach((e) => n(e, r + 1));
	};
	return n(e, 0), t;
}, le = (e) => {
	let t = /* @__PURE__ */ new Map(), n = (e, r) => {
		t.set(e.id, r), e.children.forEach((t) => n(t, e.id));
	};
	return n(e, null), t;
}, Q = ({ header: e = "Zoomer failed", message: t }) => /* @__PURE__ */ x(o, {
	align: "center",
	justify: "center",
	gap: "density-md",
	className: "rounded-lg bg-surface-raised px-density-2xl text-center",
	style: { minHeight: 240 },
	children: [
		/* @__PURE__ */ b(M, {
			size: 32,
			className: "text-feedback-danger",
			"aria-hidden": !0
		}),
		/* @__PURE__ */ b(s, {
			kind: "title/sm",
			children: e
		}),
		/* @__PURE__ */ b(s, {
			kind: "body/regular/sm",
			className: "text-feedback-danger",
			children: t
		})
	]
}), $ = ({ node: r, depth: i, breadcrumb: a, expandedNodeIds: c, highlightedNodeId: l, selectedNodeId: u, onAsk: d, onToggle: f }) => {
	let p = c.has(r.id), m = !!(r.why || r.result || r.problems.length > 0 || r.children.length > 0), h = u === r.id, g = l === r.id, _ = i === 0 ? "min-w-0 overflow-hidden rounded-lg bg-surface-raised" : "min-w-0 overflow-hidden rounded-md border border-base bg-surface-raised", v = g ? "ring-2 ring-brand ring-offset-2 ring-offset-surface-base" : h ? "ring-1 ring-brand" : "";
	return /* @__PURE__ */ x("section", {
		id: X(r.id),
		className: `${_} ${v} transition-shadow`,
		"data-zoomer-node-id": r.id,
		"aria-label": `Zoomer node ${r.title}`,
		children: [/* @__PURE__ */ x(n, {
			align: "start",
			justify: "between",
			gap: "density-md",
			className: "min-w-0 px-density-lg py-density-md",
			children: [/* @__PURE__ */ b("button", {
				type: "button",
				className: m ? "min-w-0 flex-1 cursor-pointer text-left" : "min-w-0 flex-1 text-left",
				"aria-expanded": m ? p : void 0,
				"aria-label": m ? `${p ? "Collapse" : "Expand"} ${r.title}` : r.title,
				onClick: () => m && f(r.id),
				children: /* @__PURE__ */ x(n, {
					align: "start",
					justify: "between",
					gap: "density-lg",
					className: "min-w-0",
					children: [/* @__PURE__ */ x(n, {
						align: "start",
						gap: "density-sm",
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ b("span", {
							className: "mt-density-xxs shrink-0 text-secondary",
							children: b(m ? p ? ee : te : D, {
								size: 16,
								"aria-hidden": !0
							})
						}), /* @__PURE__ */ x(o, {
							gap: "density-xs",
							className: "min-w-0",
							children: [/* @__PURE__ */ x(n, {
								align: "center",
								gap: "density-sm",
								className: "min-w-0 flex-wrap",
								children: [/* @__PURE__ */ b(e, {
									color: oe(r.kind),
									kind: "outline",
									children: r.kind
								}), /* @__PURE__ */ b(s, {
									kind: i === 0 ? "title/sm" : "body/semibold/md",
									children: r.title
								})]
							}), /* @__PURE__ */ b(s, {
								kind: "body/regular/sm",
								className: "break-words text-secondary",
								children: r.what
							})]
						})]
					}), Object.keys(r.metrics).length > 0 ? /* @__PURE__ */ b(n, {
						align: "center",
						justify: "end",
						gap: "density-xs",
						className: "shrink-0 flex-wrap",
						children: Object.entries(r.metrics).map(([t, n]) => /* @__PURE__ */ b(e, {
							color: "gray",
							kind: "solid",
							children: se(t, n)
						}, t))
					}) : null]
				})
			}), /* @__PURE__ */ x(t, {
				kind: "tertiary",
				size: "small",
				className: "shrink-0",
				"aria-label": `Ask Zoomer about ${r.title}`,
				onClick: () => d({
					node: r,
					breadcrumb: a
				}),
				children: [/* @__PURE__ */ b(k, {
					size: 14,
					"aria-hidden": !0
				}), " Ask"]
			})]
		}), p && m ? /* @__PURE__ */ x(o, {
			gap: "density-lg",
			className: "border-t border-base px-density-xl py-density-lg",
			children: [
				r.why ? /* @__PURE__ */ x(n, {
					align: "start",
					gap: "density-lg",
					className: "min-w-0",
					children: [/* @__PURE__ */ b(s, {
						kind: "label/regular/sm",
						className: "shrink-0 text-secondary",
						style: { width: "5rem" },
						children: "Why"
					}), /* @__PURE__ */ b(s, {
						kind: "body/regular/sm",
						className: "min-w-0 break-words",
						children: r.why
					})]
				}) : null,
				r.result ? /* @__PURE__ */ x(n, {
					align: "start",
					gap: "density-lg",
					className: "min-w-0",
					children: [/* @__PURE__ */ b(s, {
						kind: "label/regular/sm",
						className: "shrink-0 text-secondary",
						style: { width: "5rem" },
						children: "Result"
					}), /* @__PURE__ */ b(s, {
						kind: "body/regular/sm",
						className: "min-w-0 whitespace-pre-wrap break-words border-l-2 border-brand pl-density-md",
						children: r.result
					})]
				}) : null,
				r.problems.length > 0 ? /* @__PURE__ */ x(n, {
					align: "start",
					gap: "density-lg",
					className: "min-w-0",
					children: [/* @__PURE__ */ b(s, {
						kind: "label/regular/sm",
						className: "shrink-0 text-secondary",
						style: { width: "8rem" },
						children: "Setbacks & uncertainty"
					}), /* @__PURE__ */ b("ul", {
						className: "min-w-0 list-disc space-y-density-xs pl-density-lg",
						children: r.problems.map((e) => /* @__PURE__ */ b("li", {
							className: "text-feedback-warning",
							children: /* @__PURE__ */ b(s, {
								kind: "body/regular/sm",
								className: "break-words",
								children: e
							})
						}, e))
					})]
				}) : null,
				r.children.length > 0 ? /* @__PURE__ */ b(o, {
					gap: "density-sm",
					className: "border-l border-base pl-density-lg",
					children: r.children.map((e) => /* @__PURE__ */ b($, {
						node: e,
						depth: i + 1,
						breadcrumb: [...a, e.title],
						expandedNodeIds: c,
						highlightedNodeId: l,
						selectedNodeId: u,
						onAsk: d,
						onToggle: f
					}, e.id))
				}) : null
			]
		}) : null]
	});
}, ue = ({ hierarchy: e, host: t, trace: n }) => {
	let [r, i] = m(() => ce(e)), [a, o] = m(null), [s, c] = m(!1), [l, h] = m(null), g = f(() => le(e), [e]), _ = p(null);
	d(() => () => {
		_.current !== null && window.clearTimeout(_.current);
	}, []);
	let v = u((e) => {
		i((t) => {
			let n = new Set(t);
			return n.has(e) ? n.delete(e) : n.add(e), n;
		});
	}, []), S = u((e) => {
		o(e), c(!0);
	}, []), C = u((e) => {
		g.has(e) && (i((t) => /* @__PURE__ */ new Set([...t, ...re(g, e)])), h(e), c(!0), window.setTimeout(() => {
			document.getElementById(X(e))?.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
		}, 0), _.current !== null && window.clearTimeout(_.current), _.current = window.setTimeout(() => {
			h((t) => t === e ? null : t);
		}, 2500));
	}, [g]);
	return /* @__PURE__ */ x(y, { children: [/* @__PURE__ */ b($, {
		node: e,
		depth: 0,
		breadcrumb: [e.title],
		expandedNodeIds: r,
		highlightedNodeId: l,
		selectedNodeId: a?.node.id ?? null,
		onAsk: S,
		onToggle: v
	}), a ? /* @__PURE__ */ b(ae, {
		baseURL: B(t.workspaceId, n.id, a.node.id),
		open: s,
		target: a,
		onClose: () => c(!1),
		onCitation: C
	}) : null] });
}, de = ({ host: e, trace: t }) => {
	let { data: i } = W(e, t);
	return R(i) ? /* @__PURE__ */ x(o, {
		gap: "density-xs",
		className: "rounded-md bg-surface-raised px-density-md py-density-sm",
		style: { minWidth: "15rem" },
		children: [/* @__PURE__ */ x(n, {
			align: "center",
			justify: "between",
			gap: "density-md",
			children: [/* @__PURE__ */ x(n, {
				align: "center",
				gap: "density-xs",
				children: [/* @__PURE__ */ b(a, {
					size: "small",
					"aria-label": "Zoomer generation running"
				}), /* @__PURE__ */ b(s, {
					kind: "label/semibold/sm",
					children: "Zoomer"
				})]
			}), /* @__PURE__ */ x(s, {
				kind: "label/regular/sm",
				className: "tabular-nums text-secondary",
				children: [i.progress, "%"]
			})]
		}), /* @__PURE__ */ b(r, {
			kind: "determinate",
			size: "small",
			value: i.progress,
			"aria-label": "Zoomer generation progress"
		})]
	}) : null;
}, fe = ({ host: i, trace: c }) => {
	let { data: l, error: u, isLoading: d } = W(i, c), f = G(i, c);
	return d ? /* @__PURE__ */ b(n, {
		align: "center",
		justify: "center",
		style: { minHeight: 320 },
		children: /* @__PURE__ */ b(a, {
			size: "large",
			description: "Loading Zoomer…"
		})
	}) : u || !l ? /* @__PURE__ */ b(Q, { message: Z(u) }) : l.status === "not_started" ? /* @__PURE__ */ x(o, {
		align: "center",
		justify: "center",
		gap: "density-lg",
		className: "rounded-lg bg-surface-raised text-center",
		style: { minHeight: 360 },
		children: [
			/* @__PURE__ */ b(j, {
				className: "size-12 text-brand",
				"aria-hidden": !0
			}),
			/* @__PURE__ */ x(o, {
				align: "center",
				gap: "density-xs",
				children: [/* @__PURE__ */ b(s, {
					kind: "title/md",
					children: "Generate Zoomer"
				}), /* @__PURE__ */ b(s, {
					kind: "body/regular/sm",
					className: "text-secondary",
					children: "Explore this trace as a generated semantic hierarchy."
				})]
			}),
			/* @__PURE__ */ x(t, {
				kind: "primary",
				color: "brand",
				onClick: () => f.mutate(!1),
				disabled: f.isPending,
				children: [/* @__PURE__ */ b(O, {
					size: 16,
					"aria-hidden": !0
				}), " Generate semantic map"]
			}),
			f.error ? /* @__PURE__ */ b(s, {
				kind: "body/regular/sm",
				className: "text-feedback-danger",
				children: Z(f.error)
			}) : null
		]
	}) : R(l) ? /* @__PURE__ */ x(o, {
		align: "center",
		justify: "center",
		gap: "density-xl",
		className: "rounded-lg bg-surface-raised px-density-2xl",
		style: { minHeight: 360 },
		children: [
			/* @__PURE__ */ b(a, {
				size: "large",
				description: l.message
			}),
			/* @__PURE__ */ x(o, {
				gap: "density-sm",
				className: "w-full",
				style: { maxWidth: "36rem" },
				children: [/* @__PURE__ */ x(n, {
					align: "center",
					justify: "between",
					gap: "density-md",
					children: [/* @__PURE__ */ b(s, {
						kind: "body/semibold/sm",
						children: l.stage.replaceAll("_", " ")
					}), /* @__PURE__ */ x(s, {
						kind: "body/regular/sm",
						className: "tabular-nums text-secondary",
						children: [l.progress, "%"]
					})]
				}), /* @__PURE__ */ b(r, {
					kind: "determinate",
					value: l.progress,
					"aria-label": "Zoomer generation progress"
				})]
			}),
			/* @__PURE__ */ b(s, {
				kind: "body/regular/sm",
				className: "text-secondary",
				children: "You can switch views or leave this page. Generation will continue in the background."
			})
		]
	}) : l.status === "failed" ? /* @__PURE__ */ x(o, {
		align: "center",
		justify: "center",
		gap: "density-lg",
		className: "rounded-lg bg-surface-raised px-density-2xl",
		style: { minHeight: 360 },
		children: [/* @__PURE__ */ b(Q, {
			header: "Zoomer generation failed",
			message: l.error ?? l.message
		}), /* @__PURE__ */ x(t, {
			kind: "primary",
			color: "brand",
			onClick: () => f.mutate(!1),
			disabled: f.isPending,
			children: [/* @__PURE__ */ b(A, {
				size: 16,
				"aria-hidden": !0
			}), " Retry generation"]
		})]
	}) : l.hierarchy ? /* @__PURE__ */ x(o, {
		gap: "density-lg",
		className: "min-w-0",
		children: [/* @__PURE__ */ x(n, {
			align: "center",
			justify: "between",
			gap: "density-lg",
			className: "min-w-0",
			children: [/* @__PURE__ */ x(o, {
				gap: "density-xs",
				className: "min-w-0",
				children: [/* @__PURE__ */ x(n, {
					align: "center",
					gap: "density-sm",
					children: [
						/* @__PURE__ */ b(j, {
							size: 18,
							className: "text-brand",
							"aria-hidden": !0
						}),
						/* @__PURE__ */ b(s, {
							kind: "title/sm",
							children: "Semantic map"
						}),
						/* @__PURE__ */ b(e, {
							color: "green",
							kind: "solid",
							children: "Ready"
						})
					]
				}), /* @__PURE__ */ b(s, {
					kind: "body/regular/sm",
					className: "text-secondary",
					children: "Traverse the run from outcome to the telemetry that supports it."
				})]
			}), /* @__PURE__ */ x(t, {
				kind: "tertiary",
				size: "small",
				onClick: () => f.mutate(!0),
				disabled: f.isPending,
				children: [/* @__PURE__ */ b(A, {
					size: 14,
					"aria-hidden": !0
				}), " Regenerate"]
			})]
		}), /* @__PURE__ */ b(ue, {
			hierarchy: l.hierarchy,
			host: i,
			trace: c
		})]
	}) : /* @__PURE__ */ b(Q, { message: "Zoomer completed without a semantic hierarchy." });
}, pe = (e) => null, me = (e) => [], he = [{
	id: "zoomer",
	label: "Zoomer",
	description: "Explore this trace as a generated semantic hierarchy.",
	View: fe,
	Activity: de
}];
//#endregion
export { pe as Root, me as navItems, he as traceViews };
