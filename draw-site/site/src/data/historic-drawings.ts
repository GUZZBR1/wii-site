import type { Bilingual } from '../i18n';

export interface HistoricDrawing {
  artist: Bilingual;
  year: string;
  title: Bilingual;
  image: string;
  alt: Bilingual;
  source: string;
  /** Fala imaginada, em voz do criador, usada na abertura do site (não é citação literal). */
  thought: Bilingual;
}

export const historicDrawings: HistoricDrawing[] = [
  {
    artist: { pt: 'Leonardo da Vinci', en: 'Leonardo da Vinci' },
    year: 'c. 1490',
    title: { pt: 'Homem Vitruviano', en: 'Vitruvian Man' },
    image: '/images/archive/vitruvian.jpg',
    alt: {
      pt: 'Estudo de proporções humanas de Leonardo da Vinci, desenhado a tinta.',
      en: 'Study of human proportions by Leonardo da Vinci, drawn in ink.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Vitruvian.jpg',
    thought: { pt: 'Se eu medir o corpo inteiro, talvez eu entenda como ele se move.', en: 'If I measure the whole body, perhaps I will understand how it moves.' },
  },
  {
    artist: { pt: 'Eadweard Muybridge', en: 'Eadweard Muybridge' },
    year: '1878',
    title: { pt: 'Cavalo em movimento', en: 'The Horse in Motion' },
    image: '/images/archive/muybridge-gallop.jpg',
    alt: {
      pt: 'Sequência de fotografias de um cavalo a galope, quadro a quadro.',
      en: 'Sequence of photographs of a galloping horse, frame by frame.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_gallop.jpg',
    thought: { pt: 'O olho não alcança o galope. Uma câmera por passo, e o movimento se revela.', en: 'The eye cannot catch the gallop. One camera per step, and the motion reveals itself.' },
  },
  {
    artist: { pt: 'Étienne-Jules Marey', en: 'Étienne-Jules Marey' },
    year: '1886',
    title: { pt: 'Cronofotografia', en: 'Chronophotography' },
    image: '/images/archive/marey-horse.jpg',
    alt: {
      pt: 'Cronofotografia de um cavalo branco em movimento, várias posições sobre a mesma chapa.',
      en: 'Chronophotograph of a white horse in motion, several positions on the same plate.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:%C3%89tienne-Jules_Marey,_Cheval_blanc_mont%C3%A9,_1886,_locomotion_du_cheval,_exp%C3%A9rience_4,_Chronophotographie_sur_plaque_fixe,_n%C3%A9gatif.jpg',
    thought: { pt: 'E se todas as posições do corpo coubessem em uma só imagem?', en: 'What if every position of the body fit in a single image?' },
  },
  {
    artist: { pt: 'Léon Theremin', en: 'Léon Theremin' },
    year: 'c. 1927',
    title: { pt: 'Theremin', en: 'Theremin' },
    image: '/images/archive/theremin-termen.jpg',
    alt: {
      pt: 'Léon Theremin com as mãos no ar ao lado de seu instrumento, tocado sem tocá-lo.',
      en: 'Léon Theremin with his hands in the air beside his instrument, played without touching it.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Lev_Termen_playing_-_cropped.jpg',
    thought: { pt: 'Nenhum toque. Só a mão no ar, e o som obedece.', en: 'No touch. Just a hand in the air, and the sound obeys.' },
  },
  {
    artist: { pt: 'Nintendo e Mattel', en: 'Nintendo and Mattel' },
    year: '1989',
    title: { pt: 'Power Glove', en: 'Power Glove' },
    image: '/images/archive/power-glove.jpg',
    alt: {
      pt: 'Luva Power Glove do NES, com o painel de botões no antebraço.',
      en: 'NES Power Glove, with the button panel on the forearm.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Power_Glove.jpg',
    thought: { pt: 'E se a própria mão fosse o controle?', en: 'What if the hand itself were the controller?' },
  },
  {
    artist: { pt: 'Sony', en: 'Sony' },
    year: '2003',
    title: { pt: 'EyeToy', en: 'EyeToy' },
    image: '/images/archive/eyetoy.jpg',
    alt: {
      pt: 'Câmera EyeToy do PlayStation 2, que jogava com o corpo do jogador.',
      en: 'PlayStation 2 EyeToy camera, which played the game with the player’s body.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:EyeToy_camera_2.jpg',
    thought: { pt: 'Uma câmera, o jogador no meio da tela. Nenhum controle.', en: 'One camera, the player in the middle of the screen. No controller.' },
  },
  {
    artist: { pt: 'Nintendo', en: 'Nintendo' },
    year: '2006',
    title: { pt: 'Wii Remote', en: 'Wii Remote' },
    image: '/images/archive/wii-remote.jpg',
    alt: {
      pt: 'Controle Wii Remote branco com o Nunchuk ligado por cabo.',
      en: 'White Wii Remote with the Nunchuk attached by cable.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Nintendo-Wii-Remote-wNunchuk.jpg',
    thought: { pt: 'Balance o braço e o jogo entende. Qualquer um sabe jogar.', en: 'Swing your arm and the game understands. Anyone knows how to play.' },
  },
  {
    artist: { pt: 'Microsoft', en: 'Microsoft' },
    year: '2010',
    title: { pt: 'Kinect', en: 'Kinect' },
    image: '/images/archive/kinect.jpg',
    alt: {
      pt: 'Sensor Kinect do Xbox 360, que dispensava o controle: o corpo era o controle.',
      en: 'Xbox 360 Kinect sensor, which dropped the controller: the body was the controller.',
    },
    source: 'https://commons.wikimedia.org/wiki/File:Kinect_Sensor_at_E3_2010_(front).jpg',
    thought: { pt: 'Você é o controle.', en: 'You are the controller.' },
  },
];
