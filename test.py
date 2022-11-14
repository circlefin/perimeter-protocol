RAY = 10 ** 27

def precompute(snapshots):
    rayed_snapshots = [ each * RAY for each in snapshots ]
    accumulations = []
    accumulated_differences = []
    
    for each in rayed_snapshots: 
        if accumulated_differences:
            accumulations.append(
                accumulations[-1] + 
                each * accumulated_differences[-1] / RAY
            )
            accumulated_differences.append((RAY - each) * accumulated_differences[-1] / RAY)
        else:
            accumulations.append(each)
            accumulated_differences = [RAY - each]

    return accumulations, accumulated_differences


def run(snapshots: list[tuple[int, int]], balance, start=0):
    accumulations, accumulated_differences = precompute(snapshots)

    accumulation_total = accumulations[-1] if accumulations else 0
    accumulation_offset = accumulations[start - 1] if len(accumulations) > 0 and start >= 1 else 0 
    accumulation_divisor = RAY/accumulated_differences[start - 1] if len(accumulated_differences) > 0 and start >= 1 else 1

    return balance * accumulation_divisor * (accumulation_total - accumulation_offset) / RAY


if __name__ == "__main__":
    print("Case 0")
    result = run([], 100, start=0)
    print(f'Case 0 result: {result}')
    assert result == 0, "Case 0 failed"

    print("Case 1")
    result = run([0.5], 100, start=0)
    print(f'Case 1 result: {result}')
    assert round(result, 3) == 50, "Case 1 failed"
    
    print("Case 2")
    result = run([0.5, 0.5], 100, start=0)
    print(f'Case 2 result: {result}')
    assert round(result, 3) == 75, "Case 2 failed"
    
    print("Case 3")
    result = run([0.5, 0.5, 0.5], 100, start=0)
    print(f'Case 3 result: {result}')
    assert round(result, 3) == 87.5, "Case 3 failed"
    
    print("Case 4")
    result = run([0.5, 0.5, 0.5, 0.5], 100, start=0)
    print(f'Case 4 result: {result}')
    assert round(result, 3) == 93.75, "Case 4 failed"

    print("Case 5")
    result = run([0.5, 0.5, 0.5, 0.5, 0.5], 100, start=0)
    print(f'Case 5 result: {result}')
    assert round(result, 3) == 96.875, "Case 5 failed"

    print("Case 6")
    result = run([0.5, 0.1], 100, start=0)
    print(f'Case 6 result: {result}')
    assert round(result, 3) == (50.0 + 5.0), "Case 6 failed"

    print("Case 7")
    result = run([0.5, 0.1, 0.33], 100, start=0)
    print(f'Case 7 result: {result}')
    assert round(result, 3) == (50 + 5.0 + 45.0 * 0.33), "Case 7 failed"

    print("Case 7")
    result = run([0.5, 0.1, 0.33, 0.7], 100, start=0)
    print(f'Case 7 result: {result}')
    assert round(result, 3) == (50 + 5.0 + 45.0 * 0.33 + 21.105), "Case 7 failed"

    print("Case 8")
    result = run([0.5, 0.1, 0.33, 0.7], 100, start=1)
    print(f'Case 8 result: {result}')
    assert round(result, 2) == 81.91, "Case 8 failed"

    print("Case 8.5")
    result = run([0.18, 0.1, 0.33, 0.7], 100, start=1)
    print(f'Case 8.5 result: {result}')
    assert round(result, 2) == 81.91, "Case 8.5 failed"

    print("Case 9")
    result = run([0.5, 0.1, 0.33, 0.7], 100, start=2)
    print(f'Case 9 result: {result}')
    assert round(result, 1) == 79.9, "Case 9 failed"