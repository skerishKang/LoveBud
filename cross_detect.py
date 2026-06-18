import math
from collections import deque
from typing import List, Optional
import dataclasses


@dataclasses.dataclass
class CrossSignal:
    index: int
    type: str  # 'golden' | 'dead'
    short_sma: float
    long_sma: float


def detect_crosses(
    data: List[float],
    short: int = 5,
    long: int = 10,
) -> List[CrossSignal]:
    """O(n) 단일패스 골든크로스/데드크로스 감지.

    Args:
        data: 입력 시계열 (종가 기준).
        short: 단기 SMA 기간 (기본 5).
        long:  장기 SMA 기간 (기본 10).

    Returns:
        크로스 발생 시점 리스트 (인덱스 오름차순).

    Edge cases:
        - NaN → 윈도우 리셋, NaN 이후 충분한 데이터 쌓일 때까지 미검출.
        - 데이터 부족 (len < long+1) → 빈 리스트.
        - 동일값 크로스 허용 (prev_s <= prev_l, prev_s >= prev_l).
    """
    if short >= long:
        raise ValueError(f'short({short}) >= long({long})')
    if short < 2:
        raise ValueError(f'short({short}) < 2')

    n = len(data)
    if n < long + 1:
        return []

    results: List[CrossSignal] = []
    short_q: deque[float] = deque()
    long_q: deque[float] = deque()
    short_sum = 0.0
    long_sum = 0.0
    prev_s: Optional[float] = None
    prev_l: Optional[float] = None

    for i, price in enumerate(data):
        if math.isnan(price):
            short_q.clear()
            long_q.clear()
            short_sum = long_sum = 0.0
            prev_s = prev_l = None
            continue

        # ── short window ──
        short_q.append(price)
        short_sum += price
        if len(short_q) > short:
            short_sum -= short_q.popleft()

        # ── long window ──
        long_q.append(price)
        long_sum += price
        if len(long_q) > long:
            long_sum -= long_q.popleft()

        curr_s: Optional[float] = short_sum / short if len(short_q) == short else None
        curr_l: Optional[float] = long_sum / long if len(long_q) == long else None

        # ── cross detection ──
        if prev_s is not None and prev_l is not None and curr_s is not None and curr_l is not None:
            if prev_s <= prev_l and curr_s > curr_l:
                results.append(CrossSignal(i, 'golden', round(curr_s, 4), round(curr_l, 4)))
            elif prev_s >= prev_l and curr_s < curr_l:
                results.append(CrossSignal(i, 'dead', round(curr_s, 4), round(curr_l, 4)))

        prev_s = curr_s
        prev_l = curr_l

    return results


# ════════════════════════════════════════════════════
#  Test cases
# ════════════════════════════════════════════════════

def _assert_equal(actual, expected, msg: str = ''):
    try:
        assert actual == expected, (
            f'FAIL {msg or ""}\n'
            f'  expected: {expected}\n'
            f'  actual:   {actual}'
        )
    except TypeError:
        assert len(actual) == len(expected), (
            f'FAIL {msg or ""} (len)\n'
            f'  expected len={len(expected)}, actual len={len(actual)}'
        )
        for a, e in zip(actual, expected):
            assert a.index == e.index and a.type == e.type and \
                   math.isclose(a.short_sma, e.short_sma) and \
                   math.isclose(a.long_sma, e.long_sma), (
                f'FAIL {msg or ""}\n'
                f'  expected: {e}\n'
                f'  actual:   {a}'
            )


def test_golden_cross():
    """단기 SMA가 장기 SMA를 아래에서 위로 돌파."""
    # flat 10 → 상승: short(5)가 long(10)을 추월
    data = [10.0] * 10 + [11, 12, 13, 14, 15, 16]
    # index 9:  short(10.0), long(10.0)  → first valid, prev=None → skip
    # index 10: short=(10*4+11)/5=10.2, long=(10*9+11)/10=10.1
    #           prev_s=10 <= prev_l=10 AND curr_s=10.2 > curr_l=10.1 → GOLDEN
    res = detect_crosses(data, short=5, long=10)
    assert len(res) == 1, f'expected 1 cross, got {len(res)}'
    assert res[0].type == 'golden', f'expected golden, got {res[0].type}'
    assert res[0].index == 10
    print('  ✓ test_golden_cross')
    return res


def test_death_cross():
    """단기 SMA가 장기 SMA를 위에서 아래로 돌파."""
    data = [15.0] * 10 + [14, 13, 12, 11, 10, 9]
    res = detect_crosses(data, short=5, long=10)
    assert len(res) == 1, f'expected 1 cross, got {len(res)}'
    assert res[0].type == 'dead', f'expected dead, got {res[0].type}'
    assert res[0].index == 10
    print('  ✓ test_death_cross')
    return res


def test_no_cross():
    """단기 SMA가 항상 장기 SMA 위에 있음 → 크로스 없음."""
    data = [20.0] * 5 + [25.0] * 15
    res = detect_crosses(data, short=5, long=10)
    assert len(res) == 0, f'expected 0 crosses, got {len(res)}'
    print('  ✓ test_no_cross')


def test_no_cross_below():
    """단기 SMA가 항상 장기 SMA 아래 → 크로스 없음."""
    data = [5.0] * 5 + [6.0] * 15
    res = detect_crosses(data, short=5, long=10)
    assert len(res) == 0, f'expected 0 crosses, got {len(res)}'
    print('  ✓ test_no_cross_below')


def test_equal_value_cross():
    """동일값 유지 후 추월 → 크로스 허용 (<= / >= 조건).

    long SMA(10)=10,  short SMA(5)=10 일 때
    다음 틱에 short가 10.2, long이 10.1 → prev_s==prev_l 상황에서도 크로스 감지.
    """
    data = [10.0] * 10 + [11, 12, 13, 14, 15, 16]
    res = detect_crosses(data, short=5, long=10)
    # 첫 cross가 index 10 (데이터 설계상 위 golden_cross와 동일)
    assert len(res) == 1, f'expected 1 cross for equal-value scenario, got {len(res)}'
    assert res[0].index == 10
    print('  ✓ test_equal_value_cross')


def test_nan_handling():
    """NaN 등장 시 윈도우 리셋, 리셋 후 데이터 충분할 때까지 미검출."""
    data = ([10.0] * 10) + [float('nan')] + ([15.0] * 10)
    # NaN 이후 short_q 재시작 → index 15(15+5-1)에 short SMA 복원
    # long_q 재시작 → index 20(15+10-1)에 long SMA 복원 → 데이터 20까지 총 21개(index 0~20)
    # NaN 이전: all 10 → no cross
    # NaN 이후: short SMA 복원 후 long SMA 복원 전까지 detection 불가
    #           index 20이 마지막 (data 길이 21)
    #             short SMA(5): data[16:21] = [15,15,15,15,15]/5 = 15
    #             long SMA(10): data[11:21] = [15,...,15]/10 = 15
    #             prev가 없으므로 cross skip
    res = detect_crosses(data, short=5, long=10)
    assert len(res) == 0, f'expected 0 crosses (NaN reset), got {len(res)}'
    print('  ✓ test_nan_handling')


def test_insufficient_data():
    """데이터 수 < long+1 → 빈 리스트."""
    res = detect_crosses([1.0, 2, 3, 4, 5, 6, 7, 8, 9], short=5, long=10)
    assert len(res) == 0
    print('  ✓ test_insufficient_data')


def test_empty_data():
    """빈 리스트 → 빈 리스트."""
    res = detect_crosses([], short=5, long=10)
    assert len(res) == 0
    print('  ✓ test_empty_data')


def test_multi_cross():
    """Golden → Dead 연속 크로스."""
    # flat 10 → 상승 → 하락 → 상승
    data = (
        [10.0] * 10
        + [11, 12, 13, 14, 15, 16]   # golden at idx 10
        + [15, 14, 13, 12, 11, 10]   # death at idx 16 ?
    )
    # index 10: golden (검증됨)
    # 이후 short가 5주기 뒤 하락 반영:
    #   idx 13: data[9:14] = [10,11,12,13,14]/5 = 12? no...
    # 정확한 계산은 생략, 다중 크로스가 나오는지만 확인
    res = detect_crosses(data, short=5, long=10)
    # 적어도 2개 이상 (golden → ... → death)
    assert len(res) >= 2, f'expected ≥2 crosses for multi-cross, got {len(res)}'
    assert res[0].type == 'golden'
    assert res[-1].type == 'dead', f'expected last to be dead, got {res[-1].type}'
    print(f'  ✓ test_multi_cross ({len(res)} crosses: {[r.type for r in res]})')


def test_invalid_params():
    """short >= long → ValueError."""
    try:
        detect_crosses([1, 2, 3], short=10, long=5)
        assert False, 'should have raised ValueError'
    except ValueError:
        pass
    try:
        detect_crosses([1, 2, 3], short=1, long=5)
        assert False, 'should have raised ValueError (short < 2)'
    except ValueError:
        pass
    print('  ✓ test_invalid_params')


def test_single_element_window():
    """short=2가 최소, short >= 2 보장."""
    # gold: data 짧아서 long 미달
    data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    # short=2, long=3
    # index 2: first long SMA
    #   short(2): (4+3)/2=3.5, long(3): (4+3+2)/3=3.0
    #   ... 간단히 에러 안 나는지만 확인
    res = detect_crosses(data, short=2, long=3)
    assert isinstance(res, list)
    print(f'  ✓ test_single_element_window ({len(res)} crosses)')


def run_tests():
    print('detect_crosses tests\n')
    tests = [
        test_golden_cross,
        test_death_cross,
        test_no_cross,
        test_no_cross_below,
        test_equal_value_cross,
        test_nan_handling,
        test_insufficient_data,
        test_empty_data,
        test_multi_cross,
        test_invalid_params,
        test_single_element_window,
    ]
    passed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except AssertionError as e:
            print(f'  ✗ {t.__name__}: {e}')
        except Exception as e:
            print(f'  ✗ {t.__name__}: UNEXPECTED {type(e).__name__}: {e}')
    print(f'\n{passed}/{len(tests)} passed')
    return passed == len(tests)


if __name__ == '__main__':
    run_tests()
