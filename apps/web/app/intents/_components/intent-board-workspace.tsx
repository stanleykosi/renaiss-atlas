"use client";

import Link from "next/link";
import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HandCoins,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CreateIntentResponse, IntentBoardOverview, IntentMatchView, IntentView } from "@/lib/intent-types";
import { cn } from "@/lib/utils";

type IntentBoardWorkspaceProps = {
  initialData: IntentBoardOverview;
};

type IntentFormState = {
  creatorAlias: string;
  creatorWallet: string;
  intentType: "buy" | "sell" | "bundle" | "trade" | "watch" | "quest";
  queryText: string;
  tcg: string;
  characterName: string;
  setName: string;
  cardNumber: string;
  grader: string;
  grade: string;
  language: string;
  minYear: string;
  maxYear: string;
  minPriceUsd: string;
  maxPriceUsd: string;
  requiresSerialAdjacency: boolean;
  requiresExternalComp: boolean;
  minLiquidityScore: string;
};

const defaultFormState: IntentFormState = {
  creatorAlias: "",
  creatorWallet: "",
  intentType: "buy",
  queryText: "",
  tcg: "",
  characterName: "",
  setName: "",
  cardNumber: "",
  grader: "",
  grade: "",
  language: "",
  minYear: "",
  maxYear: "",
  minPriceUsd: "",
  maxPriceUsd: "",
  requiresSerialAdjacency: false,
  requiresExternalComp: false,
  minLiquidityScore: ""
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatScore(value: number | null | undefined) {
  if (value == null) return "N/A";
  return value.toFixed(0);
}

function formatDate(value: string | null | undefined) {
  if (value == null) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function confidenceVariant(value: string) {
  if (value === "high") return "default";
  if (value === "medium") return "secondary";
  return "outline";
}

function riskVariant(flag: string) {
  if (flag === "mock_data") return "warning";
  if (flag.includes("spam") || flag.includes("mismatch") || flag.includes("stale")) return "destructive";
  return "outline";
}

function compactId(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function cleanPayload(form: IntentFormState) {
  return {
    creatorAlias: form.creatorAlias.trim() || undefined,
    creatorWallet: form.creatorWallet.trim() || undefined,
    intentType: form.intentType,
    queryText: form.queryText.trim(),
    tcg: form.tcg.trim() || undefined,
    characterName: form.characterName.trim() || undefined,
    setName: form.setName.trim() || undefined,
    cardNumber: form.cardNumber.trim() || undefined,
    grader: form.grader.trim() || undefined,
    grade: form.grade.trim() || undefined,
    language: form.language.trim() || undefined,
    minYear: form.minYear.trim() || undefined,
    maxYear: form.maxYear.trim() || undefined,
    minPriceUsd: form.minPriceUsd.trim() || undefined,
    maxPriceUsd: form.maxPriceUsd.trim() || undefined,
    requiresSerialAdjacency: form.requiresSerialAdjacency,
    requiresExternalComp: form.requiresExternalComp,
    minLiquidityScore: form.minLiquidityScore.trim() || undefined
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isCreateIntentResponse(value: unknown): value is CreateIntentResponse {
  return isObject(value) && isObject(value["intent"]) && typeof value["persisted"] === "boolean";
}

function responseError(value: unknown) {
  return isObject(value) && typeof value["error"] === "string"
    ? value["error"]
    : "Intent submission failed.";
}

function withIntent(data: IntentBoardOverview, intent: IntentView): IntentBoardOverview {
  const intents = [intent, ...data.intents.filter((item) => item.id !== intent.id)];
  const matches = intents.flatMap((item) => item.matches);

  return {
    ...data,
    intents,
    health: {
      activeIntents: intents.filter((item) => item.status === "active").length,
      matchedCards: new Set(matches.map((match) => match.tokenId)).size,
      highConfidenceMatches: matches.filter((match) => match.confidence === "high").length,
      mockData: data.health.mockData || intent.mockData
    }
  };
}

export function IntentBoardWorkspace({ initialData }: IntentBoardWorkspaceProps) {
  const [data, setData] = React.useState(initialData);
  const [form, setForm] = React.useState<IntentFormState>(defaultFormState);
  const [status, setStatus] = React.useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [pending, setPending] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const allMatches = React.useMemo(
    () => data.intents.flatMap((intent) => intent.matches),
    [data.intents]
  );

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  function updateField<Key extends keyof IntentFormState>(key: Key, value: IntentFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submitIntent(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setPending(true);

    try {
      const response = await fetch("/api/intents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(cleanPayload(form))
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus({ tone: "error", message: responseError(body) });
        return;
      }

      if (!isCreateIntentResponse(body)) {
        setStatus({ tone: "error", message: "Intent API returned an unexpected shape." });
        return;
      }

      setData((current) => withIntent(current, body.intent));
      setForm(defaultFormState);
      setStatus({
        tone: "success",
        message: body.persisted
          ? "Intent saved and matched against current cards."
          : "Intent preview generated from labeled demo data."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Target className="h-4 w-4" aria-hidden="true" />}
          label="Active intents"
          value={data.health.activeIntents}
          detail={`${data.intents.length} total`}
        />
        <KpiCard
          icon={<HandCoins className="h-4 w-4" aria-hidden="true" />}
          label="Matched cards"
          value={data.health.matchedCards}
          detail={`${allMatches.length} matches`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          label="High confidence"
          value={data.health.highConfidenceMatches}
          detail={data.health.mockData ? "mock-labeled" : "database"}
        />
        <KpiCard
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          label="Source"
          value={data.sourceMode}
          detail={formatDate(data.generatedAt)}
        />
      </section>

      <section className="rounded-md border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={data.health.mockData ? "warning" : "secondary"}>
              {data.health.mockData ? "Mock data labeled" : "Postgres"}
            </Badge>
            <Badge variant="outline">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              Read only
            </Badge>
            <span className="text-sm text-muted-foreground">
              Intents are demand signals, not orders, bids, approvals, escrow, or trade execution.
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground uppercase">
            deterministic matching
          </span>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <CreateIntentForm
          form={form}
          hydrated={hydrated}
          pending={pending}
          status={status}
          onSubmit={submitIntent}
          updateField={updateField}
        />

        <div className="flex flex-col gap-6">
          <IntentList intents={data.intents} />
          <MatchList matches={allMatches} />
        </div>
      </section>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-muted-foreground">{label}</CardTitle>
          <div className="text-primary">{icon}</div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function CreateIntentForm({
  form,
  hydrated,
  pending,
  status,
  onSubmit,
  updateField
}: {
  form: IntentFormState;
  hydrated: boolean;
  pending: boolean;
  status: { tone: "success" | "error"; message: string } | null;
  onSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;
  updateField: <Key extends keyof IntentFormState>(key: Key, value: IntentFormState[Key]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <CardTitle>Create Intent</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          data-hydrated={hydrated ? "true" : "false"}
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <fieldset className="grid gap-4 disabled:opacity-70" disabled={!hydrated || pending}>
          <Field label="Intent text" htmlFor="queryText">
            <Textarea
              id="queryText"
              name="queryText"
              required
              minLength={3}
              maxLength={500}
              placeholder="Looking for PSA 10 Japanese One Piece cards under $150."
              value={form.queryText}
              onChange={(event) => updateField("queryText", event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" htmlFor="intentType">
              <Select
                id="intentType"
                name="intentType"
                value={form.intentType}
                onChange={(event) =>
                  updateField("intentType", event.target.value as IntentFormState["intentType"])
                }
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="bundle">Bundle</option>
                <option value="trade">Trade</option>
                <option value="watch">Watch</option>
                <option value="quest">Quest</option>
              </Select>
            </Field>
            <Field label="Alias" htmlFor="creatorAlias">
              <Input
                id="creatorAlias"
                name="creatorAlias"
                maxLength={80}
                placeholder="collector alias"
                value={form.creatorAlias}
                onChange={(event) => updateField("creatorAlias", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Wallet" htmlFor="creatorWallet">
            <Input
              id="creatorWallet"
              name="creatorWallet"
              inputMode="text"
              placeholder="0x..."
              value={form.creatorWallet}
              onChange={(event) => updateField("creatorWallet", event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="TCG" id="tcg" value={form.tcg} update={(value) => updateField("tcg", value)} />
            <TextField
              label="Character"
              id="characterName"
              value={form.characterName}
              update={(value) => updateField("characterName", value)}
            />
            <TextField label="Set" id="setName" value={form.setName} update={(value) => updateField("setName", value)} />
            <TextField
              label="Card number"
              id="cardNumber"
              value={form.cardNumber}
              update={(value) => updateField("cardNumber", value)}
            />
            <TextField label="Grader" id="grader" value={form.grader} update={(value) => updateField("grader", value)} />
            <TextField label="Grade" id="grade" value={form.grade} update={(value) => updateField("grade", value)} />
            <TextField
              label="Language"
              id="language"
              value={form.language}
              update={(value) => updateField("language", value)}
            />
            <NumberField
              label="Min liquidity"
              id="minLiquidityScore"
              value={form.minLiquidityScore}
              max={100}
              update={(value) => updateField("minLiquidityScore", value)}
            />
            <NumberField
              label="Min year"
              id="minYear"
              value={form.minYear}
              min={1800}
              max={2200}
              update={(value) => updateField("minYear", value)}
            />
            <NumberField
              label="Max year"
              id="maxYear"
              value={form.maxYear}
              min={1800}
              max={2200}
              update={(value) => updateField("maxYear", value)}
            />
            <NumberField
              label="Min price"
              id="minPriceUsd"
              value={form.minPriceUsd}
              min={0}
              step="0.01"
              update={(value) => updateField("minPriceUsd", value)}
            />
            <NumberField
              label="Max price"
              id="maxPriceUsd"
              value={form.maxPriceUsd}
              min={0}
              step="0.01"
              update={(value) => updateField("maxPriceUsd", value)}
            />
          </div>

          <div className="grid gap-2">
            <CheckField
              label="Require serial adjacency"
              checked={form.requiresSerialAdjacency}
              onChange={(checked) => updateField("requiresSerialAdjacency", checked)}
            />
            <CheckField
              label="Require accepted external comp"
              checked={form.requiresExternalComp}
              onChange={(checked) => updateField("requiresExternalComp", checked)}
            />
          </div>

          {status == null ? null : (
            <div
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                status.tone === "success"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              )}
              role="status"
            >
              {status.message}
            </div>
          )}

          <Button type="submit" disabled={!hydrated || pending || form.queryText.trim().length < 3}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Target className="h-4 w-4" aria-hidden="true" />}
            Create intent
          </Button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function IntentList({ intents }: { intents: IntentView[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Active Intents</CardTitle>
          </div>
          <Badge variant="outline">{intents.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {intents.length === 0 ? (
          <EmptyState
            title="No intents"
            detail="Create a specific demand signal to generate deterministic matches."
          />
        ) : (
          <div className="grid gap-3">
            {intents.map((intent) => (
              <article key={intent.id} className="rounded-md border bg-secondary/30 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={intent.status === "active" ? "default" : "secondary"}>
                        {intent.status}
                      </Badge>
                      <Badge variant="outline">{formatType(intent.intentType)}</Badge>
                      <Badge variant={intent.mockData ? "warning" : "secondary"}>{intent.sourceLabel}</Badge>
                    </div>
                    <h2 className="mt-2 text-sm font-medium">{intent.queryText}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {intent.creatorAlias ?? "anonymous"} - {formatDate(intent.createdAt)}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="font-mono text-2xl font-semibold">{intent.matches.length}</p>
                    <p className="text-xs text-muted-foreground">matches</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {intent.tcg == null ? null : <Badge variant="outline">{intent.tcg}</Badge>}
                  {intent.characterName == null ? null : <Badge variant="outline">{intent.characterName}</Badge>}
                  {intent.setName == null ? null : <Badge variant="outline">{intent.setName}</Badge>}
                  {intent.cardNumber == null ? null : <Badge variant="outline">#{intent.cardNumber}</Badge>}
                  {intent.maxPriceUsd == null ? null : <Badge variant="outline">max {formatMoney(intent.maxPriceUsd)}</Badge>}
                  {intent.minLiquidityScore == null ? null : <Badge variant="outline">liq {formatScore(intent.minLiquidityScore)}+</Badge>}
                </div>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchList({ matches }: { matches: IntentMatchView[] }) {
  const sortedMatches = [...matches].sort((left, right) => right.matchScore - left.matchScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" aria-hidden="true" />
            <CardTitle>Deterministic Matches</CardTitle>
          </div>
          <Badge variant="outline">{sortedMatches.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {sortedMatches.length === 0 ? (
          <EmptyState
            title="No matches"
            detail="Atlas needs overlapping card fields, text evidence, price fit, or liquidity fit to produce a match."
          />
        ) : (
          <div className="grid gap-3">
            {sortedMatches.map((match) => (
              <MatchCard key={`${match.intentId}:${match.tokenId}`} match={match} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatchCard({ match }: { match: IntentMatchView }) {
  const card = match.card;

  return (
    <article className="rounded-md border bg-secondary/30 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={confidenceVariant(match.confidence)}>{match.confidence}</Badge>
            <Badge variant="outline">{formatScore(match.matchScore)}</Badge>
            <Badge variant="outline">{formatType(match.intentType)}</Badge>
          </div>
          <h3 className="mt-2 text-sm font-medium">
            {card == null ? compactId(match.tokenId) : card.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{match.queryText}</p>
        </div>
        {card == null ? null : (
          <div className="grid grid-cols-3 gap-2 text-left lg:w-72">
            <MiniMetric label="Ask" value={formatMoney(card.askPriceUsd)} />
            <MiniMetric label="FMV" value={formatMoney(card.fmvUsd)} />
            <MiniMetric label="Demand" value={formatScore(card.demandScore)} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {match.reasons.map((reason) => (
          <Badge key={reason} variant="outline">
            {reason}
          </Badge>
        ))}
      </div>

      {match.riskFlags.length === 0 ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {match.riskFlags.map((flag) => (
            <Badge key={flag} variant={riskVariant(flag)}>
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {flag.replaceAll("_", " ")}
            </Badge>
          ))}
        </div>
      )}

      {card == null ? null : (
        <Link
          href={`/cards/${encodeURIComponent(card.tokenId)}`}
          className={cn(buttonVariants({ variant: "ghost", className: "mt-3 h-8 px-2" }))}
        >
          Open card
        </Link>
      )}
    </article>
  );
}

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function TextField({
  label,
  id,
  value,
  update
}: {
  label: string;
  id: string;
  value: string;
  update: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input id={id} name={id} value={value} onChange={(event) => update(event.target.value)} />
    </Field>
  );
}

function NumberField({
  label,
  id,
  value,
  min,
  max,
  step,
  update
}: {
  label: string;
  id: string;
  value: string;
  min?: number;
  max?: number;
  step?: string;
  update: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        name={id}
        type="number"
        min={min}
        max={max}
        step={step ?? "1"}
        value={value}
        onChange={(event) => update(event.target.value)}
      />
    </Field>
  );
}

function CheckField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-3 rounded-md border bg-secondary/30 px-3 py-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed bg-secondary/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
