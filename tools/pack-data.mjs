/**
 * Conteúdo do compêndio "casos de exemplo". Os dois casos seguem os exemplos do PDF
 * "Did Someone Say Murder?" (R. Talsorian Games, 2024), com textos resumidos em português.
 */

const clue = (o) => ({ allowAnySkill: false, fumbleText: "", penalty: 0, redHerring: false, gmNotes: "", attempts: [], ...o });

export const GRAB_AND_SMASH = {
  _id: "cprinvGrabSmash1",
  name: "Grab and Smash (Fácil)",
  mystery: {
    difficulty: "easy",
    complexity: { max: 25, value: 25 },
    goal: "Seu bar favorito recebeu caixas extras de Smash para a noite do clube, mas alguém as \"libertou\" do depósito. Quem levou?",
    goalRevealed: true,
    gmNotes:
      "A verdade: o filho do fornecedor de Smash pegou as caixas, usando a chave do pai, e levou tudo num reboque de bicicleta até o esconderijo da turma dele, debaixo de um viaduto velho.\n\nComece com a cena do depósito (Auditoria, Perícia forense, Observação). Fofoca e Interrogatório apontam para o filho; Rastreamento leva ao esconderijo.",
    clues: [
      clue({
        id: "gsAuditing000001",
        name: "Notas de entrega",
        type: "auditing",
        skills: ["Accounting"],
        dv: 13,
        obfuscation: 0,
        damage: "3d6",
        focusDamage: "2d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "O dono do bar recebeu um lote novo de Smash naquela tarde, de um fornecedor de sempre — que tem a chave do depósito.",
      }),
      clue({
        id: "gsForensics00001",
        name: "Porta do depósito",
        type: "forensics",
        skills: ["Criminology", "Deduction"],
        dv: 13,
        obfuscation: 0,
        damage: "4d6",
        focusDamage: "3d6",
        fumbleEffect: "blocked",
        state: "available",
        revealText: "A porta externa do depósito foi aberta, mas a fechadura não foi arrombada.",
      }),
      clue({
        id: "gsGossip00000001",
        name: "Papo no bairro",
        type: "gossip",
        skills: ["Conversation"],
        dv: 13,
        obfuscation: 0,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "hidden",
        revealText: "O fornecedor tem um filho que anda de moto com os amigos num viaduto velho.",
      }),
      clue({
        id: "gsInterrogation1",
        name: "Interrogar o fornecedor",
        type: "interrogation",
        skills: ["Interrogation"],
        dv: 15,
        obfuscation: 2,
        damage: "3d6",
        focusDamage: "2d6",
        fumbleEffect: "blocked",
        state: "hidden",
        revealText: "O fornecedor tem um filho que anda de moto com os amigos num viaduto velho.",
      }),
      clue({
        id: "gsObservation001",
        name: "Beco atrás do bar",
        type: "observation",
        skills: ["Perception"],
        dv: 13,
        obfuscation: 2,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "Marcas de pneu de bicicleta muito fundas no beco atrás do bar: alguém carregou um reboque.",
      }),
      clue({
        id: "gsTracking000001",
        name: "Seguir as marcas",
        type: "tracking",
        skills: ["Tracking"],
        dv: 13,
        obfuscation: 2,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "hidden",
        revealText: "As marcas levam a uma obra onde uma ponte velha passa sobre um viaduto. Dá para ouvir música lá embaixo.",
      }),
    ],
    obstacles: [],
    hints: [
      { id: "gsHint0000000001", text: "Quem mais tem a chave do depósito? Vale conversar com quem frequenta o bairro.", revealed: false },
    ],
    clock: { enabled: false, visible: true, label: "", max: 6, value: 0 },
  },
};

export const SOMEONE_STOLE_IT_FIRST = {
  _id: "cprinvStoleFirst",
  name: "Someone Stole it First! (Média)",
  mystery: {
    difficulty: "average",
    complexity: { max: 50, value: 50 },
    goal: "Vocês entraram num Midnight Market para roubar um chip de memória ultrassecreto do cofre do anfitrião, mas quando chegaram ao escritório alguém já tinha levado. Quem foi?",
    goalRevealed: true,
    gmNotes:
      "Defina o ladrão antes da sessão. As pistas apontam para alguém que forçou o cofre, usa botas destoando do traje de festa e evita a segurança.\n\nO prédio está trancado até o fim do Midnight Market (relógio). A equipe não tem autoridade sobre os convidados.",
    clues: [
      clue({
        id: "ssDigital0000001",
        name: "Celular descartável do anfitrião",
        type: "digital",
        skills: ["Electronics/Security Tech"],
        dv: 13,
        obfuscation: 4,
        damage: "4d6",
        focusDamage: "3d6",
        fumbleEffect: "blocked",
        state: "available",
        revealText: "O anfitrião usa um celular descartável além do Agent. As mensagens mostram quem queria o item.",
      }),
      clue({
        id: "ssForensics00001",
        name: "O cofre",
        type: "forensics",
        skills: ["Criminology", "Deduction"],
        dv: 13,
        obfuscation: 2,
        damage: "4d6",
        focusDamage: "3d6",
        fumbleEffect: "blocked",
        state: "available",
        revealText: "O cofre foi forçado, não aberto com a combinação.",
      }),
      clue({
        id: "ssGossip00000001",
        name: "Inimigos do anfitrião",
        type: "gossip",
        skills: ["Conversation"],
        dv: 13,
        obfuscation: 2,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "O anfitrião tem inimigos que querem o item. São trinta convidados, mas as informações começam a se repetir depois de seis conversas.",
      }),
      clue({
        id: "ssInterrogation1",
        name: "Alguém rondando?",
        type: "interrogation",
        skills: ["Interrogation"],
        dv: 15,
        obfuscation: 2,
        damage: "3d6",
        focusDamage: "2d6",
        fumbleEffect: "blocked",
        state: "available",
        revealText: "Alguns convidados viram alguém rondando de forma suspeita. São trinta, mas as informações se repetem depois de três conversas.",
      }),
      clue({
        id: "ssObservation001",
        name: "Quem evita a segurança",
        type: "observation",
        skills: ["Human Perception"],
        dv: 17,
        obfuscation: 4,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "Alguém no evento está claramente tentando não chamar a atenção da segurança.",
      }),
      clue({
        id: "ssObservation002",
        name: "Traje obrigatório",
        type: "observation",
        skills: ["Wardrobe & Style"],
        dv: 13,
        obfuscation: 4,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "O evento tem traje obrigatório. Uma pessoa não está bem vestida para a ocasião.",
      }),
      clue({
        id: "ssResearch000001",
        name: "Imagens das câmeras",
        type: "research",
        skills: ["Library Search"],
        dv: 15,
        obfuscation: 2,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "hidden",
        revealText: "As imagens da Arquitetura NET de segurança mostram quem entrou no escritório.",
        gmNotes: "Libere depois que a equipe superar o obstáculo Digital (acesso à NET ou ao console da segurança).",
      }),
      clue({
        id: "ssTracking000001",
        name: "Marcas no carpete",
        type: "tracking",
        skills: ["Tracking"],
        dv: 15,
        obfuscation: 4,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        revealText: "O ladrão deixou marcas de bota no carpete do escritório, destoando do traje de festa.",
      }),
      clue({
        id: "ssRedHerring0001",
        name: "Convidado nervoso",
        type: "observation",
        skills: ["Human Perception"],
        dv: 13,
        obfuscation: 0,
        damage: "2d6",
        focusDamage: "1d6",
        fumbleEffect: "none",
        state: "available",
        redHerring: true,
        revealText: "",
        gmNotes: "Pista falsa: o convidado roubou o convite dos pais e está nervoso por isso, não pelo cofre.",
      }),
    ],
    obstacles: [
      {
        id: "ssObsAuthority01",
        name: "Sem autoridade",
        type: "authority",
        description: "Vocês são convidados: não têm como interrogar os presentes à força nem dar ordens à segurança.",
        skills: [],
        dv: 13,
        state: "active",
        attempts: [],
        results: [],
      },
      {
        id: "ssObsDigital0001",
        name: "Câmera do escritório",
        type: "digital",
        description: "Há uma câmera no escritório, mas é preciso entrar na Arquitetura NET ou usar um console na sala de segurança para ver as imagens.",
        skills: ["Electronics/Security Tech"],
        dv: 15,
        state: "active",
        attempts: [],
        results: [],
      },
      {
        id: "ssObsDistraction",
        name: "A festa continua",
        type: "distraction",
        description: "O Midnight Market segue a todo vapor e a equipe precisa parecer que está curtindo para não levantar suspeita.",
        skills: ["Acting", "Wardrobe & Style"],
        dv: 13,
        state: "active",
        attempts: [],
        results: [],
      },
      {
        id: "ssObsTerritory01",
        name: "Cena vigiada",
        type: "territory",
        description: "Não dá para voltar à cena do crime sem chamar a atenção dos seguranças.",
        skills: ["Stealth"],
        dv: 15,
        state: "hidden",
        attempts: [],
        results: [],
      },
    ],
    hints: [
      { id: "ssHint0000000001", text: "Quem está vestido para arrombar, e não para festejar?", revealed: false },
      { id: "ssHint0000000002", text: "A sala de segurança guarda o que a câmera do escritório viu.", revealed: false },
    ],
    clock: {
      enabled: true,
      visible: true,
      label: "O prédio está trancado: as portas abrem quando o Midnight Market terminar",
      max: 6,
      value: 0,
    },
  },
};

export const GUIDE = {
  _id: "cprinvGuide00001",
  name: "Investigação: como usar",
  pages: [
    {
      _id: "cprinvGuidePage1",
      name: "Como usar",
      type: "text",
      title: { show: true, level: 1 },
      text: {
        format: 1,
        content: `
<h2>Sistema de investigação (Did Someone Say Murder?)</h2>
<p>Regras opcionais da DLC gratuita da R. Talsorian Games. Este módulo é conteúdo de fã não oficial.</p>
<h3>Foco</h3>
<p>Foco = 10 + 5 × (INT + VONT) ÷ 2, arredondado para cima. Aparece na ficha do personagem. Com Foco 0 não dá para fazer Testes de Evidência. Descansar um dia recupera INT + VONT; um teste de Concentração CD 15 recupera mais 5 (botão de cama na ficha).</p>
<h3>Mistérios</h3>
<p>Abra a lista pelo botão <strong>Mistérios</strong> na aba de diário. Cada mistério tem Objetivo e Complexidade (Fácil 25, Média 50, Desafiadora 100, Difícil 150, Lendária 200). Quando a Complexidade chega a 0, o caso está resolvido.</p>
<p>Para os jogadores verem um mistério, use o botão de olho no painel (dá permissão de Observador).</p>
<h3>Pistas e Testes de Evidência</h3>
<ul>
<li>Cada pista tem perícias sugeridas, CD, Ofuscação (0, 2, 4 ou 6), dano e dano de Foco. Mude o estado para <em>Disponível</em> quando a equipe tiver motivo para investigá-la.</li>
<li>No sucesso, o dano menos a Ofuscação sai da Complexidade e o texto da pista é revelado.</li>
<li>Na falha, o personagem perde Foco. Fumble (1 no dado e falha) aplica a complicação da pista.</li>
<li>Cada personagem tenta cada pista uma vez por dia. O dia segue o relógio do mundo e o botão <strong>Novo dia</strong>.</li>
<li>Pistas falsas parecem normais. Quem supera a CD descobre que são falsas; quem falha perde Foco.</li>
</ul>
<h3>Dicas e obstáculos</h3>
<p>Pedir dica é um teste de Dedução CD 15 que custa 1d6 de Foco sempre; no sucesso, o mestre recebe a próxima dica preparada para revelar. Obstáculos custam 1d6 de Foco quando superados e 2d6 quando não. O relógio correndo marca prazos.</p>
<h3>Casos de exemplo</h3>
<p>Importe <em>Grab and Smash</em> e <em>Someone Stole it First!</em> deste compêndio. As anotações do mestre ficam na aba Anotações do painel.</p>`,
      },
      sort: 0,
    },
  ],
};
