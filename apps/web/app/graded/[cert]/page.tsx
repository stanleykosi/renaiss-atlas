import { redirect } from "next/navigation";

type GradedCertPageProps = {
  params: Promise<{ cert: string }>;
};

export default async function GradedCertPage({ params }: GradedCertPageProps) {
  const { cert } = await params;
  redirect(`/graded?cert=${encodeURIComponent(cert)}`);
}
