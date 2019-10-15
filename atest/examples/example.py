'''Fibonacci accumulation'''

from itertools import  (accumulate, chain)


# fibs :: Integer :: [Integer]
def fibs(n):
    '''An accumulation of the first n integers in
       the Fibonacci series. The accumulator is a
       pair of the two preceding numbers.
    '''
    def go(ab, _):
        a, b = ab
        return (b, a + b)

    return [xy[1] for xy in accumulate(
        chain(
            [(0, 1)],
            range(1, n)
        ),
        go
    )]


# MAIN ---
if __name__ == '__main__':
    print(
        'First twenty: ' + repr(
            fibs(20)
        )
    )
