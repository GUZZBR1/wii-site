/** Contrato de entrada do cursor de mão. Quem o preenche é o pipeline de CV; a UI só consome. */
export type HandCursorInput = {
  /** Há mão rastreada e o modo 'hand' está ativo. */
  visible: boolean;
  /** Posição do ponteiro, em px da viewport. */
  x: number;
  y: number;
  /** 0..1 durante a sincronização. */
  syncProgress: number;
  synced: boolean;
  /** Pinça pressionada neste frame. */
  pinching: boolean;
  /** A pinça acabou de confirmar o clique. */
  pinchRelease: boolean;
  /** 0..1 do gesto sustentado de voltar/fechar. */
  backProgress: number;
};

/** Sem dados de mão: nada é desenhado nem acionado. */
export const HAND_IDLE: HandCursorInput = {
  visible: false, x: 0, y: 0, syncProgress: 0, synced: false, pinching: false, pinchRelease: false, backProgress: 0,
};
