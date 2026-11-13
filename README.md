# Did Someone Say Murder? — Investigação para Cyberpunk RED

Módulo para **Foundry VTT v12** com o sistema **Cyberpunk RED - CORE 0.92.4**. Automatiza o sistema de investigação opcional
da DLC gratuita *Did Someone Say Murder?* (R. Talsorian Games, set/2024).

Conteúdo de fã não oficial. Cyberpunk RED é marca da R. Talsorian Games.

## Instalação

1. Descompacte o `cpr-investigation.zip` dentro de `Data/modules/`. Vai surgir a pasta `cpr-investigation/` com o
   `module.json` dentro.
2. Reinicie o Foundry, abra o mundo e ative **Did Someone Say Murder? — Investigação** em *Gerenciar módulos*.

## O que o módulo faz

- **Foco** na ficha de personagem e de mook: `10 + 5 × ⌈(INT + VONT) ÷ 2⌉`. Clique no valor para ajustar, no ícone de
  cama para descansar (recupera INT + VONT; Concentração CD 15 dá +5) e no relógio para ver o histórico.
- **Mistérios** (botão *Mistérios* na aba de diário): Objetivo, Complexidade por dificuldade (25/50/100/150/200),
  pistas, obstáculos, dicas, relógio correndo e o Foco dos investigadores.
- **Teste de Evidência**: o jogador escolhe a pista e a perícia; a rolagem usa a janela do próprio sistema (Sorte,
  modificadores, crítico). O mestre conectado compara com a CD, rola o dano e aplica:
  - sucesso → dano − Ofuscação sai da Complexidade e o texto da pista é revelado;
  - falha → dano de Foco;
  - fumble (1 no dado e falha) → complicação da pista (bloqueio, −4 na Autópsia, aviso);
  - uma tentativa por pista por personagem por dia (ou ilimitadas, marcando *tentativas ilimitadas* no mistério); Foco 0 impede testes.
- **Pistas falsas**, **dicas** (Dedução CD 15, sempre custa 1d6 de Foco) e **obstáculos** (1d6 superando, 2d6 falhando).
- **12 tipos de pista** com as perícias, danos e fumbles da tabela do PDF, editáveis.
- **Compêndio** com *Grab and Smash* e *Someone Stole it First!* prontos e um diário "como usar".
- Português e inglês.

## Uso rápido (mestre)

1. *Mistérios → Novo mistério* (ou importe um caso do compêndio *Investigação: casos de exemplo*).
2. Preencha o Objetivo e adicione pistas. Deixe como *Oculta* o que a equipe ainda não encontrou.
3. Clique no olho para deixar o mistério visível aos jogadores.
4. Mude pistas para *Disponível* conforme a investigação avança. Use *Novo dia* para liberar novas tentativas.

## Configurações

| Configuração | Padrão |
| --- | --- |
| Mostrar CD aos jogadores | Desligado |
| Complexidade para os jogadores (números / barra / oculta) | Barra |
| Empate com a CD conta como sucesso | Desligado (regra: superar a CD) |
| Foco para NPCs (mooks) | Ligado |
| Usar o relógio do mundo para os dias | Ligado |

## API para macros

```js
const inv = game.modules.get("cpr-investigation").api;
inv.openMysteries();
inv.openMystery("Nome do mistério");
inv.getFocus(actor);              // { value, max, log }
await inv.modifyFocus(actor, -3, "motivo");
await inv.rest(actor);
await inv.newDay();               // só mestre
```

## Detalhes técnicos

- Foco fica em `flags.cpr-investigation.focus` do ator; mistérios ficam em `flags.cpr-investigation.mystery` de um
  JournalEntry que abre o painel próprio. O sistema não é alterado.
- Partes internas do sistema usadas (conferir ao atualizar o CPR): `modules/chat/cpr-chat.js` (`RenderRollCard`),
  `modules/utils/cpr-systemUtils.js` (`slugify`), `item.createRoll("skill" | "roleAbility")`,
  `cprRoll.handleRollDialog/roll/resultTotal/initialRoll`. Tudo isso está isolado em `scripts/cpr-adapter.js`.
- A versão 0.93 do sistema (ainda não lançada) exige Foundry v13 e muda rolagens e fichas; o adaptador e a injeção do
  Foco na ficha (`scripts/sheet-integration.js`) são o que vai precisar de ajuste.

## Limitações conhecidas

- Foco não pode ser barra do token (o Foundry só aceita atributos do sistema nas barras).
- Jogadores com permissão de Observador conseguem, pelo console do navegador, ler os dados do mistério (pistas ocultas e
  marcadas como falsas). A interface não mostra nada disso para eles.
- Testado com Foundry e sistema simulados (40 testes automatizados); faça o primeiro teste num mundo de cópia.

## Desenvolvimento

```bash
npm install
npm test             # regras, fluxo do mestre e templates
npm run build:packs  # recompila o compêndio a partir de tools/pack-data.mjs
```

## Publicar uma versão nova

1. Suba `version` no `module.json` (ex.: `0.1.1`) e atualize `.github/release-notes.md`.
2. Faça commit e push na `main`.
3. O GitHub Actions roda os testes, cria a tag e a release com `module.json` e `module.zip`. O Foundry pega a
   atualização pelo manifesto. Também dá para rodar o workflow *Release* manualmente na aba Actions.
