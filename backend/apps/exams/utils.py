"""Grade helpers."""

GRADE_BANDS = [
    (90, "A+", 4.0),
    (80, "A", 4.0),
    (70, "A-", 3.7),
    (60, "B", 3.0),
    (50, "C", 2.0),
    (40, "D", 1.0),
    (0, "F", 0.0),
]


def grade_for_percentage(percentage) -> str:
    try:
        value = float(percentage)
    except (TypeError, ValueError):
        return "F"
    for threshold, letter, _points in GRADE_BANDS:
        if value >= threshold:
            return letter
    return "F"


def grade_point(letter: str) -> float:
    for _threshold, code, points in GRADE_BANDS:
        if code == letter:
            return points
    return 0.0


def is_pass(percentage) -> bool:
    try:
        return float(percentage) >= 40
    except (TypeError, ValueError):
        return False
