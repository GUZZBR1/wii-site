"""Gera as figuras dos artigos. Rode: python3 -I docs/research/figures/make_figures.py

Cada artigo ganha uma funcao `fig_NN_k` e uma linha em FIGURES. As duas abaixo sao
exemplos do padrao: copie a forma, troque rotulos.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import figkit as k  # noqa: E402


def fig_02_1() -> str:
    """Cadeia de medicao como caixa-preta (artigo 08, F1)."""
    parts = [
        k.text(
            40,
            44,
            "Cadeia de medição da latência (sistema como caixa-preta)",
            20,
            k.INK,
            True,
        ),
        k.row(
            40,
            100,
            [
                "Gesto observável",
                "Sistema de desenho assistido por câmera",
                "Resposta visível",
            ],
            w=340,
            gap=40,
        ),
        k.text(210, 200, "t₀: instante do gesto", 14, k.MUTED, False, "middle"),
        k.text(950, 200, "t₁: a resposta aparece", 14, k.MUTED, False, "middle"),
        k.arrow(210, 215, 950, 215, dashed=True),
        k.text(
            545,
            255,
            "latência de ponta a ponta = t₁ − t₀ (medida por câmera externa)",
            14,
            k.TEAL,
            True,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        300,
        "Cadeia de medição",
        "Gesto, sistema e resposta visível, com a latência entre eles.",
        *parts,
    )


def fig_02_2() -> str:
    """Forma esquematica de uma distribuicao acumulada, sem dados."""
    parts = [
        k.text(40, 44, "Distribuição de latência: forma ilustrativa", 20, k.INK, True),
        k.curve_placeholder(
            135,
            80,
            900,
            220,
            "observações ordenadas",
            "proporção acumulada",
            falling=False,
        ),
    ]
    return k.svg(
        1200,
        390,
        "Distribuição de latência, ilustrativa",
        "Curva conceitual sem amostras, valores ou unidades nos eixos.",
        *parts,
    )


def fig_02_3() -> str:
    """Desenho conceitual de uma condicao com atraso experimental."""
    parts = [
        k.text(40, 44, "Condição opcional com atraso controlado", 20, k.INK, True),
        k.row(
            70,
            115,
            ["Gesto", "Atraso experimental", "Resposta visível"],
            w=300,
            h=78,
            gap=65,
        ),
        k.text(
            600,
            250,
            "Comparar condições sem observar etapas internas",
            16,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        310,
        "Teste opcional com atraso",
        "Gesto, condição temporal controlada e resposta visível como eventos externos.",
        *parts,
    )


def fig_01_1() -> str:
    """Par esquematico entre cena real e cena simulada."""
    parts = [
        k.text(40, 44, "Par de condições para comparação", 20, k.INK, True),
        k.box(70, 105, 470, 180, "Captura real", k.TEAL, "exemplo esquemático"),
        k.box(660, 105, 470, 180, "Cena simulada", k.CLAY, "exemplo esquemático"),
        k.text(
            600,
            345,
            "Comparar a mesma pergunta, documentando diferenças da cena",
            15,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    for x, color in [(150, k.TEAL), (740, k.CLAY)]:
        parts.extend(
            [
                f'<rect x="{x}" y="155" width="300" height="82" rx="4" fill="#FFFFFF" stroke="{color}" stroke-width="2"/>',
                f'<path d="M{x + 35} 210 L{x + 90} 185 L{x + 160} 218 L{x + 252} 175" fill="none" stroke="{k.MUTED}" stroke-width="3"/>',
            ]
        )
    return k.svg(
        1200,
        390,
        "Par conceitual real e simulado",
        "Duas cenas esquemáticas para ilustrar comparação por condição, sem dados observados.",
        *parts,
    )


def fig_01_2() -> str:
    """Fluxo externo de validacao e delimitacao da evidencia sintetica."""
    parts = [
        k.text(40, 44, "Comparação e delimitação da evidência", 20, k.INK, True),
        k.row(
            45,
            125,
            [
                "Condição definida",
                "Pares por condição",
                "Concordância",
                "Limites relatados",
            ],
            w=245,
            h=85,
            gap=40,
        ),
        k.text(
            600,
            290,
            "A comparação avalia evidência, não o processo de geração",
            15,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        350,
        "Fluxo de validação por pares",
        "Condições correspondentes são comparadas e o escopo das conclusões é documentado.",
        *parts,
    )


def fig_01_3() -> str:
    """Forma ilustrativa de concordancia entre dificuldade sim-real."""
    parts = [
        k.text(40, 44, "Concordância da dificuldade por condição", 20, k.INK, True),
        k.curve_placeholder(
            135,
            80,
            900,
            220,
            "dificuldade simulada (qualitativa)",
            "dificuldade observada em dados reais",
            falling=False,
        ),
    ]
    return k.svg(
        1200,
        390,
        "Concordância simulada e real, ilustrativa",
        "Forma conceitual ascendente sem observações, pontos ou valores numéricos.",
        *parts,
    )


def fig_04_1() -> str:
    """Mapa de categorias de barreiras de acessibilidade."""
    labels = [
        (45, 110, "Motora", "alcance e controle"),
        (430, 110, "Visual", "percepção e contraste"),
        (815, 110, "Cognitiva", "compreensão e memória"),
        (45, 265, "Equipamento", "disponibilidade e ajuste"),
        (430, 265, "Espaço", "superfície e mobilidade"),
        (815, 265, "Conectividade", "acesso e continuidade"),
    ]
    parts = [k.text(40, 44, "Dimensões de barreiras a investigar", 20, k.INK, True)]
    for x, y, title, detail in labels:
        parts.append(k.box(x, y, 340, 100, title, k.TEAL, detail))
    return k.svg(
        1200,
        420,
        "Mapa conceitual de barreiras",
        "Seis dimensões de acessibilidade organizadas para avaliação contextual.",
        *parts,
    )


def fig_04_2() -> str:
    """Fluxo externo do estudo com participantes."""
    parts = [
        k.text(40, 44, "Estudo de interação com participantes", 20, k.INK, True),
        k.row(
            50,
            125,
            [
                "Avaliação ética",
                "Recrutamento e consentimento",
                "Sessão de uso",
                "Instrumentos e análise",
            ],
            w=240,
            h=85,
            gap=50,
        ),
        k.text(
            600,
            300,
            "Etapas do estudo, sem representar processamento do sistema",
            15,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        360,
        "Fluxo do estudo com pessoas",
        "Etapas éticas e de coleta descritas em nível externo.",
        *parts,
    )


def fig_04_3() -> str:
    """Perfil de amostra planejado, vazio e sem contagens."""
    parts = [
        k.text(40, 44, "Perfil planejado: campos a preencher", 20, k.INK, True),
        k.matrix(
            385,
            105,
            ["motora", "visual", "cognitiva", "equipamento", "espaço", "conectividade"],
            ["perfil a descrever"],
            cell=78,
        ),
        k.text(
            780,
            375,
            "Nenhum perfil ou número de participante está preenchido",
            14,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        610,
        "Perfil de amostra planejado",
        "Matriz vazia para descrição futura da amostra, sem contagens ou resultados.",
        *parts,
    )


def fig_03_1() -> str:
    """Rastreabilidade conceitual entre planejamento, evidencias e relato."""
    parts = [
        k.text(40, 44, "Fluxo conceitual de rastreabilidade", 20, k.INK, True),
        k.row(
            55,
            115,
            ["Pergunta", "Protocolo", "Registros", "Relato"],
            w=235,
            h=76,
            gap=50,
        ),
        k.text(
            600,
            250,
            "Cada ligação deve poder ser examinada sem expor detalhes internos do sistema",
            16,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        310,
        "Rastreabilidade experimental",
        "Pergunta, protocolo, registros e relato ligados em uma cadeia conceitual.",
        *parts,
    )


def fig_03_2() -> str:
    """Distincao conceitual entre repetir, replicar e reproduzir."""
    parts = [
        k.text(40, 44, "Níveis de repetição de uma avaliação", 20, k.INK, True),
        k.row(
            70,
            115,
            ["Repetir", "Replicar", "Reproduzir"],
            w=310,
            h=105,
            gap=55,
        ),
        k.text(225, 245, "mesma equipe e materiais", 14, k.MUTED, False, "middle"),
        k.text(
            590,
            245,
            "outra equipe, protocolo compartilhado",
            14,
            k.MUTED,
            False,
            "middle",
        ),
        k.text(955, 245, "implementação independente", 14, k.MUTED, False, "middle"),
        k.text(
            600,
            270,
            "Os termos dependem da convenção adotada; declarar a definição usada",
            15,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        330,
        "Níveis de reprodutibilidade",
        "Três categorias de repetição com mudanças graduais de equipe, materiais e implementação.",
        *parts,
    )


def fig_03_3() -> str:
    """Forma ilustrativa de uma exibicao futura da variacao entre repeticoes."""
    parts = [
        k.text(40, 44, "Variação entre repetições: esquema de relato", 20, k.INK, True),
        k.curve_placeholder(
            135,
            82,
            900,
            220,
            "condições ou blocos comparados",
            "dispersão entre repetições",
            falling=False,
        ),
    ]
    return k.svg(
        1200,
        390,
        "Variação entre repetições, ilustrativa",
        "Eixos sem números e curva tracejada para indicar apenas uma forma de apresentação futura.",
        *parts,
    )


def fig_05_1() -> str:
    """Relação conceitual entre medida observável e percepção relatada."""
    parts = [
        k.text(40, 44, "Medida externa e percepção relatada", 20, k.INK, True),
        k.row(
            45,
            115,
            ["Comportamento observável", "Medida técnica", "Percepção relatada"],
            w=315,
            h=86,
            gap=55,
        ),
        k.text(
            600,
            285,
            "Associação investigada, sem afirmar causalidade",
            16,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        350,
        "Modelo conceitual de medida e percepção",
        "Observação externa e relato subjetivo são relacionados para análise sem indicar mecanismo interno ou causalidade.",
        *parts,
    )


def fig_05_2() -> str:
    """Sessao externa de estudo que combina tarefa, observacao e relatos."""
    parts = [
        k.text(40, 44, "Sessão de avaliação da experiência", 20, k.INK, True),
        k.row(
            40,
            118,
            ["Tarefa de desenho", "Registro externo", "Questionários", "Entrevista"],
            w=240,
            h=88,
            gap=40,
        ),
        k.text(
            600,
            295,
            "Fontes alinhadas na mesma sessão; interpretação posterior",
            16,
            k.MUTED,
            False,
            "middle",
        ),
    ]
    return k.svg(
        1200,
        360,
        "Desenho externo da avaliação",
        "Atividade, medida externa, questionários e entrevista sem representação de processamento interno.",
        *parts,
    )


def fig_05_3() -> str:
    """Forma esperada da associacao tecnica e percebida, sem dados."""
    parts = [
        k.text(
            40,
            44,
            "Associação entre observação e percepção: forma ilustrativa",
            20,
            k.INK,
            True,
        ),
        k.curve_placeholder(
            135,
            80,
            900,
            220,
            "medida técnica (qualitativa)",
            "avaliação percebida (qualitativa)",
            falling=False,
        ),
    ]
    return k.svg(
        1200,
        390,
        "Associação técnica e percebida, ilustrativa",
        "Forma conceitual qualitativa sem eixos numéricos, observações ou resultado medido.",
        *parts,
    )


FIGURES = {
    "02-latencia-cadeia.svg": fig_02_1,
    "02-distribuicao-latencia.svg": fig_02_2,
    "02-atraso-controlado.svg": fig_02_3,
    "01-par-real-simulado.svg": fig_01_1,
    "01-fluxo-validacao.svg": fig_01_2,
    "01-concordancia-sim-real.svg": fig_01_3,
    "04-mapa-barreiras.svg": fig_04_1,
    "04-fluxo-estudo.svg": fig_04_2,
    "04-perfil-amostra.svg": fig_04_3,
    "05-medida-percepcao.svg": fig_05_1,
    "05-desenho-estudo.svg": fig_05_2,
    "05-associacao-tecnica-percebida.svg": fig_05_3,
    "03-rastreabilidade.svg": fig_03_1,
    "03-niveis-reprodutibilidade.svg": fig_03_2,
    "03-variacao-repeticoes.svg": fig_03_3,
}


_PT_HINT = re.compile(
    r"[áàâãéêíóôõúçÁÉÍÓÚÇ]|\b(de|da|do|das|dos|para|com|que|em|uma?|sem|entre|ao|os|as)\b"
)


def main() -> None:
    out = Path(__file__).parent
    for name, fn in FIGURES.items():
        (out / name).write_text(fn(), encoding="utf-8")
        print("ok", name)

    from figures_en import EN

    k.LANG = "en"
    k.TRANSLATIONS = EN
    missing: list[str] = []
    orig_tr = k.tr

    def checked(s: str) -> str:
        r = orig_tr(s)
        if r == s and _PT_HINT.search(s):
            missing.append(s)
        return r

    k.tr = checked
    en_dir = out / "en"
    en_dir.mkdir(exist_ok=True)
    for name, fn in FIGURES.items():
        (en_dir / name).write_text(fn(), encoding="utf-8")
    k.tr = orig_tr
    k.LANG = "pt"
    if missing:
        print("UNTRANSLATED:", *sorted(set(missing)), sep="\n  ")
        raise SystemExit(1)
    print("ok en", len(FIGURES))


if __name__ == "__main__":
    main()
