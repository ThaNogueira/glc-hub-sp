import { TypeIcon } from "@/components/TypeIcon";
import { TYPES } from "@/lib/types";

export const metadata = {
  title: "Créditos",
  description: "Fontes de dados e assets usados pelo GLC Hub SP.",
};

export default function CreditsPage() {
  return (
    <>
      <h1>Créditos</h1>
      <p className="lead">
        O GLC Hub SP é um projeto de fã, feito pela e para a comunidade de Gym Leader Challenge de
        São Paulo, sem fins lucrativos.
      </p>

      <h2>Ícones de tipo</h2>
      <div className="panel">
        <p className="flex-row">
          {TYPES.map((t) => (
            <TypeIcon key={t.id} type={t.id} size={22} />
          ))}
        </p>
        <p>
          Os ícones de energia dos 11 tipos vêm dos{" "}
          <a href="https://archives.bulbagarden.net/" target="_blank" rel="noopener noreferrer">
            Bulbagarden Archives
          </a>{" "}
          e são servidos localmente (sem hotlink). Bulbapedia/Bulbagarden é um projeto comunitário
          independente, sem afiliação com este site.
        </p>
      </div>

      <h2>Dados de cartas e imagens</h2>
      <div className="panel">
        <p>
          A base de cartas usada no deck builder vem do repositório público{" "}
          <a
            href="https://github.com/PokemonTCG/pokemon-tcg-data"
            target="_blank"
            rel="noopener noreferrer"
          >
            PokemonTCG/pokemon-tcg-data
          </a>{" "}
          (mesmo dataset da{" "}
          <a href="https://pokemontcg.io/" target="_blank" rel="noopener noreferrer">
            pokemontcg.io
          </a>
          ). As imagens das cartas são servidas diretamente por images.pokemontcg.io e nunca
          hospedadas aqui.
        </p>
      </div>

      <h2>Resultados do circuito</h2>
      <div className="panel">
        <p>
          Os resultados, rankings e a agenda vêm da planilha comunitária{" "}
          <a
            href="https://docs.google.com/spreadsheets/d/1m4bGPteefWIQfjILnZ8iUbHUZj05hxoe_N907GM5c68/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GLC - Circuito SP
          </a>
          , mantida pelas lojas e organizadores do circuito.
        </p>
      </div>

      <h2>Aviso legal</h2>
      <div className="panel">
        <p>
          Este site não é afiliado, endossado ou patrocinado pela The Pokémon Company, Nintendo,
          Creatures Inc. ou GAME FREAK inc. Pokémon, Pokémon TCG e os nomes e imagens de
          personagens e cartas são marcas registradas e propriedade de seus respectivos donos, e
          são usados aqui apenas para identificação, em caráter informativo e comunitário.
        </p>
      </div>
    </>
  );
}
