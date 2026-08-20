import { getBadgeRule } from "@/lib/settings";

export const metadata = {
  title: "Regras",
  description:
    "Como funciona o Gym Leader Challenge e como as insígnias são conquistadas no circuito de São Paulo.",
};

export default async function RulesPage() {
  let badgeRule = "";
  try {
    badgeRule = await getBadgeRule();
  } catch {}

  return (
    <>
      <h1>Regras</h1>

      <h2>O formato</h2>
      <div className="panel">
        <p>
          O <strong>Gym Leader Challenge (GLC)</strong> é um formato singleton e mono-tipo do
          Pokémon TCG:
        </p>
        <ul>
          <li>Deck de exatamente 60 cartas;</li>
          <li>Apenas 1 cópia de cada carta (exceto energias básicas);</li>
          <li>Todos os Pokémon do deck compartilham um mesmo tipo;</li>
          <li>Cartas com Rule Box (ex, V, GX, Radiant, ACE SPEC...) são proibidas;</li>
          <li>Card pool: Black &amp; White em diante, com banlist própria.</li>
        </ul>
        <p className="muted small">
          Regras completas (em inglês) em{" "}
          <a href="https://gymleaderchallenge.com" target="_blank" rel="noopener noreferrer">
            gymleaderchallenge.com
          </a>
          .
        </p>
      </div>

      <h2>Obtendo sua insígnia</h2>
      <div className="panel">
        <p>{badgeRule}</p>
        <p className="muted small">
          O critério é definido por votação da comunidade e pode mudar — o site reflete a regra
          vigente.
        </p>
      </div>

      <h2>Sobre os dados</h2>
      <div className="panel">
        <p>
          Os resultados vêm da planilha comunitária <strong>GLC - Circuito SP</strong>, preenchida
          pelas lojas do circuito. O site sincroniza o log de vitórias periodicamente e recalcula
          rankings e o meta a partir dele. Como os torneios do formato nem sempre têm o número
          ideal de rodadas, os resultados são um retrato de comunidade, não um ranking competitivo
          oficial.
        </p>
      </div>
    </>
  );
}
