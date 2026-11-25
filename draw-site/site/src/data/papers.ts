import type { Bilingual } from '../i18n';

/**
 * Propostas de artigo da coleção em docs/research (rascunhos conceituais: nenhuma delas é resultado validado).
 * Os textos aqui são resumos curtos dos "Resumo" de cada proposta.
 * short/title/blurb são o texto em português; en traz a tradução para inglês (mesma estrutura).
 */
export interface Paper {
  n: string;
  short: string;
  title: string;
  blurb: string;
  en: { short: string; title: string; blurb: string };
}

export const papers: Paper[] = [
  { n: '01', short: 'dados sintéticos', title: 'Simulação e dados sintéticos para avaliar sistemas de desenho por câmera', blurb: 'Cenários simulados como complemento às gravações reais, e até onde eles servem.', en: { short: 'synthetic data', title: 'Simulation and synthetic data for evaluating camera drawing systems', blurb: 'Simulated scenarios as a complement to real recordings, and how far they are useful.' } },
  { n: '02', short: 'tempo de resposta', title: 'Desempenho temporal em sistemas de desenho assistidos por visão computacional', blurb: 'A rapidez da resposta e a continuidade que a pessoa percebe enquanto desenha.', en: { short: 'response time', title: 'Temporal performance in computer-vision-assisted drawing systems', blurb: 'The speed of the response and the continuity the person perceives while drawing.' } },
  { n: '03', short: 'reprodutibilidade', title: 'Reprodutibilidade experimental em sistemas de visão computacional com modelos externos', blurb: 'Rastrear modelos, dados e configurações para que um resultado possa ser repetido.', en: { short: 'reproducibility', title: 'Experimental reproducibility in computer vision systems with external models', blurb: 'Tracking models, data and configurations so that a result can be repeated.' } },
  { n: '04', short: 'acessibilidade', title: 'Acessibilidade e diversidade de uso em sistemas de desenho assistidos por câmera', blurb: 'Quem consegue usar, em que contextos, e onde estão as barreiras.', en: { short: 'accessibility', title: 'Accessibility and diversity of use in camera-assisted drawing systems', blurb: 'Who can use them, in which contexts, and where the barriers are.' } },
  { n: '05', short: 'experiência', title: 'Qualidade e continuidade da experiência em sistemas de desenho assistidos por câmera', blurb: 'Ligar as medidas técnicas ao que as pessoas realmente percebem ao desenhar.', en: { short: 'experience', title: 'Quality and continuity of the experience in camera-assisted drawing systems', blurb: 'Connecting technical measures to what people actually perceive when drawing.' } },
];

/** Frases do palco: curtas e honestas, a coleção é de propostas, não de resultados. */
export const paperLines: Bilingual[] = [
  { pt: 'Cinco perguntas sobre como medir um sistema que joga com o corpo.', en: 'Five questions about how to measure a system played with the body.' },
  { pt: 'Propostas de pesquisa: perguntas antes de promessas.', en: 'Research proposals: questions before promises.' },
  { pt: 'Dos dados sintéticos à experiência de quem joga.', en: 'From synthetic data to the experience of the person playing.' },
  { pt: 'O que a gente construiu, escrito para ser questionado.', en: 'What we built, written to be questioned.' },
  { pt: 'Cada traço merece ser medido com cuidado.', en: 'Every stroke deserves to be measured with care.' },
];
