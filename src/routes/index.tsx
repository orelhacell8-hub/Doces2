import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, Cake, Clock, Download, Heart, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { BuyButton } from "@/components/buy-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getSiteBackgroundImage, listProducts } from "@/lib/shop.functions";

const productsQuery = queryOptions({ queryKey: ["products"], queryFn: () => listProducts() });
const backgroundQuery = queryOptions({
  queryKey: ["site-background"],
  queryFn: () => getSiteBackgroundImage(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Doces que Vendem — Curso de Confeitaria em PDF" },
      { name: "description", content: "Aprenda a fazer doces irresistíveis e lucrativos. Apostila em PDF com entrega automática após o PIX." },
      { property: "og:title", content: "Doces que Vendem — Curso de Confeitaria" },
      { property: "og:description", content: "Receitas, custos e precificação em um PDF completo. Acesso imediato após o pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(backgroundQuery),
    ]);
  },
  component: Index,
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const benefits = [
  { icon: Cake, title: "Receitas testadas", text: "Brigadeiros gourmet, bolos no pote, cupcakes e sobremesas que encantam." },
  { icon: Wallet, title: "Precificação", text: "Aprenda a calcular custos e definir preços que dão lucro de verdade." },
  { icon: Clock, title: "Passo a passo", text: "Instruções claras, do preparo à embalagem, no seu ritmo." },
  { icon: Download, title: "Acesso imediato", text: "Seu PDF é liberado automaticamente na sua conta após o PIX." },
];

const faqs = [
  { q: "Como recebo o material?", a: "Após a confirmação do pagamento PIX pela NXGATE, o PDF aparece automaticamente na aba “Produtos entregues” da sua conta." },
  { q: "Quanto tempo demora a liberação?", a: "Normalmente poucos segundos após o pagamento. Você pode acompanhar o status na página do pedido." },
  { q: "Preciso de experiência?", a: "Não. O conteúdo foi pensado para iniciantes e para quem já faz doces e quer vender mais." },
  { q: "Posso baixar quantas vezes quiser?", a: "Sim. O material fica disponível na sua conta para acessar e baixar sempre que precisar." },
  { q: "O pagamento é seguro?", a: "Sim. O pagamento é feito via PIX processado pela NXGATE, e seus dados ficam protegidos." },
];

function Index() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: backgroundImageUrl } = useSuspenseQuery(backgroundQuery);
  const main = products[0];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative isolate overflow-hidden bg-background">
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
        )}
        <div className="absolute inset-0 bg-cream-veil" />
        <div className="relative mx-auto flex min-h-[68svh] max-w-6xl items-center justify-center px-5 py-16 md:min-h-[76svh] md:py-24">
          <div className="max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm font-semibold text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-accent" /> Curso completo em PDF
            </p>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-primary sm:text-6xl md:text-7xl">
              Doces que <em className="text-accent">vendem</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              {main?.description ?? "Aprenda receitas irresistíveis e transforme a confeitaria em renda."}
            </p>
            {main && (
              <div className="mt-9 flex flex-col items-center gap-4">
                <div
                  className="rounded-2xl border border-border/70 bg-card/85 px-7 py-4 shadow-soft backdrop-blur"
                >
                  <span className="text-sm text-muted-foreground">Investimento único</span>
                  <div className="font-display text-4xl font-bold text-primary sm:text-5xl">
                    {brl(Number(main.price))}
                  </div>
                </div>
                <BuyButton productId={main.id} />
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-success" /> PIX seguro · acesso automático
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-semibold text-primary md:text-4xl">O que você vai receber</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-chocolate-gradient text-primary-foreground">
                <b.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold">{b.title}</h3>
              <p className="mt-2 text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {products.length > 1 && (
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-center text-3xl font-semibold text-primary">Mais materiais</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {products.slice(1).map((p) => (
              <div key={p.id} className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-soft">
                <BookOpen className="h-8 w-8 text-accent" />
                <h3 className="mt-3 text-2xl font-semibold">{p.name}</h3>
                <p className="mt-2 flex-1 text-muted-foreground">{p.description}</p>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <span className="font-display text-3xl font-bold text-primary">{brl(Number(p.price))}</span>
                  <BuyButton productId={p.id} label="Comprar" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-chocolate-gradient py-20 text-primary-foreground">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-center text-3xl font-semibold md:text-4xl">Dúvidas frequentes</h2>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`f${i}`} className="border-primary-foreground/20">
                <AccordionTrigger className="text-left text-lg">{f.q}</AccordionTrigger>
                <AccordionContent className="text-base text-primary-foreground/80">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          {main && (
            <div className="mt-12 text-center">
              <BuyButton productId={main.id} label="Garantir meu acesso" />
            </div>
          )}
        </div>
      </section>

      <footer className="bg-chocolate py-10 text-primary-foreground/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 text-center text-sm md:flex-row md:justify-between md:text-left">
          <p className="font-display text-lg text-primary-foreground">
            Doces que Vendem <Heart className="inline h-4 w-4 text-accent" />
          </p>
          <p>© {new Date().getFullYear()} Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
}
