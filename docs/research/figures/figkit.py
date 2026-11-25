"""Mini biblioteca para desenhar as figuras dos artigos em SVG (sem dependencias).

Cada funcao devolve um trecho de SVG (str). Use `svg(...)` para montar o arquivo.
Figuras de curva usam `curve_placeholder`: sao ILUSTRATIVAS, sem numeros nos eixos.
"""

from __future__ import annotations

from xml.sax.saxutils import escape

INK = "#25333A"
MUTED = "#647178"
LINE = "#D8DFDD"
BG = "#F4F6F4"
TEAL = "#3E6F78"
CLAY = "#A76C4E"
VIOLET = "#7869A6"
FONT = "Arial,sans-serif"

LANG = "pt"
TRANSLATIONS: dict[str, str] = {}


def tr(s: str) -> str:
    """Traduz `s` quando LANG == "en"; caso contrario devolve igual."""
    return TRANSLATIONS.get(s, s) if LANG == "en" else s


def svg(width: int, height: int, title: str, desc: str, *parts: str) -> str:
    head = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-labelledby="t d">'
        f'<title id="t">{escape(tr(title))}</title><desc id="d">{escape(tr(desc))}</desc>'
        f'<rect width="{width}" height="{height}" rx="20" fill="{BG}"/>'
        '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
        f'markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="{MUTED}"/>'
        "</marker></defs>"
    )
    return head + "".join(parts) + "</svg>\n"


def text(
    x: float,
    y: float,
    s: str,
    size: int = 15,
    color: str = INK,
    bold=False,
    anchor="start",
) -> str:
    weight = "700" if bold else "400"
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
        f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{escape(tr(s))}</text>'
    )


def box(
    x: float, y: float, w: float, h: float, label: str, color: str = TEAL, sub: str = ""
) -> str:
    out = (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#FFFFFF" '
        f'stroke="{color}" stroke-width="2"/>'
        + text(x + w / 2, y + h / 2 + (0 if sub else 5), label, 16, INK, True, "middle")
    )
    if sub:
        out += text(x + w / 2, y + h / 2 + 20, sub, 13, MUTED, False, "middle")
    return out


def arrow(x1: float, y1: float, x2: float, y2: float, dashed: bool = False) -> str:
    dash = ' stroke-dasharray="6 5"' if dashed else ""
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{MUTED}" '
        f'stroke-width="2"{dash} marker-end="url(#a)"/>'
    )


def row(
    x: float,
    y: float,
    labels: list[str],
    w: float = 190,
    h: float = 64,
    gap: float = 50,
) -> str:
    """Caixas em linha ligadas por setas."""
    out, colors = [], [TEAL, CLAY, VIOLET]
    for i, lab in enumerate(labels):
        bx = x + i * (w + gap)
        out.append(box(bx, y, w, h, lab, colors[i % 3]))
        if i:
            out.append(arrow(bx - gap + 4, y + h / 2, bx - 4, y + h / 2))
    return "".join(out)


def curve_placeholder(
    x: float,
    y: float,
    w: float,
    h: float,
    xlabel: str,
    ylabel: str,
    falling: bool = True,
) -> str:
    """Eixos sem numeros e uma curva tracejada: forma esperada, NAO e dado."""
    y0, y1 = (y + 0.15 * h, y + 0.8 * h) if falling else (y + 0.8 * h, y + 0.15 * h)
    path = f"M{x} {y0} C{x + w * 0.4} {y0} {x + w * 0.6} {y1} {x + w} {y1}"
    return (
        f'<line x1="{x}" y1="{y}" x2="{x}" y2="{y + h}" stroke="{INK}" stroke-width="2"/>'
        f'<line x1="{x}" y1="{y + h}" x2="{x + w}" y2="{y + h}" stroke="{INK}" stroke-width="2"/>'
        f'<path d="{path}" fill="none" stroke="{CLAY}" stroke-width="3" stroke-dasharray="8 6"/>'
        + text(x + w / 2, y + h + 34, xlabel, 14, MUTED, False, "middle")
        + f'<g transform="translate({x - 18} {y + h / 2}) rotate(-90)">'
        + text(0, 0, ylabel, 14, MUTED, False, "middle")
        + "</g>"
        + text(
            x + w - 8, y + 18, "ILUSTRATIVO · sem dados medidos", 12, CLAY, True, "end"
        )
    )


def matrix(
    x: float, y: float, rows: list[str], cols: list[str], cell: float = 70
) -> str:
    """Grade de condicoes (linhas x colunas), celulas vazias."""
    out = []
    for j, c in enumerate(cols):
        out.append(
            text(x + 130 + j * cell + cell / 2, y - 10, c, 13, MUTED, False, "middle")
        )
    for i, r in enumerate(rows):
        out.append(
            text(x + 120, y + i * cell + cell / 2 + 5, r, 13, MUTED, False, "end")
        )
        for j in range(len(cols)):
            out.append(
                f'<rect x="{x + 130 + j * cell}" y="{y + i * cell}" width="{cell - 6}" '
                f'height="{cell - 6}" rx="8" fill="#FFFFFF" stroke="{LINE}" stroke-width="2"/>'
            )
    return "".join(out)


def timeline(x: float, y: float, w: float, events: list[tuple[float, str]]) -> str:
    """Linha do tempo com marcos (posicao 0 a 1)."""
    out = [
        f'<line x1="{x}" y1="{y}" x2="{x + w}" y2="{y}" stroke="{INK}" stroke-width="2"/>'
    ]
    for k, (pos, lab) in enumerate(events):
        px = x + pos * w
        up = k % 2 == 0
        out.append(f'<circle cx="{px}" cy="{y}" r="7" fill="{TEAL}"/>')
        out.append(text(px, y - 22 if up else y + 34, lab, 13, INK, False, "middle"))
    return "".join(out)
