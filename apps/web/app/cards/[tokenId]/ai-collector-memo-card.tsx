"use client";

import { useState } from "react";
import type { AiCardMemoResult } from "@renaiss/ai";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { generateCollectorRead } from "./actions";

type MemoState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; memo: AiCardMemoResult }
  | { status: "error"; message: string };

export function AiCollectorMemoCard({ tokenId }: { tokenId: string }) {
  const [state, setState] = useState<MemoState>({ status: "idle" });

  async function generateMemo() {
    setState({ status: "loading" });
    const result = await generateCollectorRead(tokenId);

    if (result.ok) {
      setState({ status: "ready", memo: result.memo });
      return;
    }

    setState({ status: "error", message: result.error });
  }

  return (
    <Card>
      <CardContent className="p-4">
        {state.status === "idle" || state.status === "loading" ? (
          <div className="grid min-h-32 place-items-center">
            <Button className="w-full sm:w-auto" onClick={generateMemo} disabled={state.status === "loading"}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {state.status === "loading" ? "Running collector read..." : "Run Collector Read"}
            </Button>
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="grid gap-4">
            <div className="rounded-md border bg-secondary/30 p-3">
              <p className="text-sm font-medium">Collector read unavailable</p>
              <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{state.message}</p>
            </div>
            <Button className="w-full" onClick={generateMemo}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Try Again
            </Button>
          </div>
        ) : null}

        {state.status === "ready" ? <CollectorRead memo={state.memo} /> : null}
      </CardContent>
    </Card>
  );
}

function CollectorRead({ memo }: { memo: AiCardMemoResult }) {
  const output = memo.output;

  return (
    <div className="grid gap-4">
      <section className="rounded-md border bg-secondary/30 p-3">
        <p className="text-xs font-medium uppercase text-muted-foreground">Collector read</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{output.recommendation}</p>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Read drivers</h3>
        <ul className="mt-2 grid gap-2">
          {output.evidence.map((item, index) => (
            <li key={`${index}:${item}`} className="rounded-md border bg-card px-3 py-2 text-sm leading-6">
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-medium uppercase text-muted-foreground">Watchouts</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {output.risks.map((risk, index) => (
            <Badge key={`${index}:${risk}`} variant="outline">
              {risk}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}
