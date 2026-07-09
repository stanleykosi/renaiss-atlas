"use client";

import { useState } from "react";
import type { AiCardMemoResult } from "@renaiss/ai";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { generateCollectorBrief } from "./actions";

type BriefState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; brief: AiCardMemoResult }
  | { status: "error"; message: string };

export function CollectorBriefCard({ tokenId }: { tokenId: string }) {
  const [state, setState] = useState<BriefState>({ status: "idle" });

  async function generateBrief() {
    setState({ status: "loading" });
    const result = await generateCollectorBrief(tokenId);

    if (result.ok) {
      setState({ status: "ready", brief: result.brief });
      return;
    }

    setState({ status: "error", message: result.error });
  }

  return (
    <Card>
      <CardContent className="p-4">
        {state.status === "idle" || state.status === "loading" ? (
          <div className="grid min-h-32 place-items-center">
            <Button className="w-full sm:w-auto" onClick={generateBrief} disabled={state.status === "loading"}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {state.status === "loading" ? "Generating Collector Brief..." : "Generate Collector Brief"}
            </Button>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="grid gap-4">
            <div className="rounded-md border bg-secondary/30 p-3">
              <p className="text-sm font-medium">Collector Brief unavailable</p>
              <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{state.message}</p>
            </div>
            <Button className="w-full" onClick={generateBrief}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        ) : null}

        {state.status === "ready" ? <CollectorBrief brief={state.brief} /> : null}
      </CardContent>
    </Card>
  );
}

function CollectorBrief({ brief }: { brief: AiCardMemoResult }) {
  const output = brief.output;

  return (
    <div className="grid gap-4">
      <section className="rounded-md border bg-secondary/30 p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Collector Brief</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{output.recommendation}</p>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Why this call</h3>
        <ul className="mt-2 grid gap-2">
          {output.evidence.map((item, index) => (
            <li key={`${index}:${item}`} className="rounded-md border bg-card px-3 py-2 text-sm leading-6">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Action limits</h3>
        <ul className="mt-2 grid gap-2">
          {output.risks.map((risk, index) => (
            <li key={`${index}:${risk}`} className="rounded-md border bg-card px-3 py-2 text-sm leading-6">
              {risk}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
