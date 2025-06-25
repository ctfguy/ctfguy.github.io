---
title: "IERAE CTF 2025"
description: "Writeups for IERAE crypto challenge"
date: 'Jun 23 2025'
tags: ['writeup','crypto','ierae']
authors: ['ctfguy']
---
## Trunc


### Challenge File

```python
# chall.sage 
from sage.all import *
import secrets

q = 2**20
n = 512
m = 4 * n
c = 8

with open("flag.txt", "rb") as f:
    FLAG = f.read().strip()

def trunc_matrix(M, c):
    F = M.base_ring()
    modulus = 2**c
    return matrix(F, M.nrows(), M.ncols(), [F(Integer(x) - (Integer(x) % modulus)) for x in M.list()])

def keygen():
    U = random_matrix(Integers(q), m, n)
    A = trunc_matrix(U, c)
    s = vector(Zmod(q), [secrets.randbelow(q) for _ in range(n)])
    e = vector(Zmod(q), [ZZ(secrets.randbelow(400)) for _ in range(m)])
    return A, A * s + e

def encrypt_bit(x, A, b):
    S = [i for i in range(A.nrows()) if secrets.randbits(1)]
    if len(S) == 0:
        S = [secrets.randbelow(A.nrows())] 
    a_sum = sum([A[i] for i in S])
    b_sum = sum([b[i] for i in S])
    encoded_bit = (x * (q // 2)) % q
    return (a_sum, (encoded_bit + b_sum) % q)

def encrypt_message(message, A, b):
    bits = []
    for byte in message:
        for i in range(8):
            bits.append((byte >> i) & 1)
    ciphertext = [encrypt_bit(bit, A, b) for bit in bits]
    return ciphertext

def main():
    A, b = keygen()
    flag_ciphertext = encrypt_message(FLAG, A, b)
    print("q =", q)
    print("n =", n)
    print("m =", m)
    print("c =", c)
    print("A =", [list(A[i]) for i in range(A.nrows())])
    print("b =", list(b))
    print("flag_ciphertext =", flag_ciphertext)

if __name__ == "__main__":
    main()
```

#### Summary of Challenge
The challenge outputs a standard **Learning With Errors** public key and an LWE‑encrypted flag:

* modulus $q = 2^{20}$
* secret length $n = 512$
* number of equations $m = 4n = 2048$
* “truncation” parameter $c = 8$
  every entry of $A$ is an **exact multiple of** $2^c = 256$
* noise vector $e \in {0,\dots,399}^m $

```python
b = A·s + e   (mod q)                  # public part of key
a_sum, c2 = encrypt_bit(…)             # ciphertext pairs
```

Our task is to recover **FLAG** from the printed `A`, `b`, and `flag_ciphertext`.

---
### Key observation – drop a factor 256

Because every coefficient of $A$ is divisible by 256 we can divide each public equation by that factor:

$$
A = 256·A', \qquad
b   = 256·A's + e \pmod{q}
\;\Longrightarrow\;
A's \equiv \bigl\lfloor b/256 \bigr\rfloor \pmod{q/256}\,.
$$

Set $q' = q/256 = 4096$.
After division we still have an LWE instance — *but with dramatically smaller noise*:

* $e \mapsto e' := \lfloor e/256 \rfloor \in{0,1}$.

If we could find rows where $e'=0$ the system would become **noise‑free**.

#### Which rows are noise‑free?

The byte $e\_i \bmod 256$ is *visible* in $b\_i$.
If that byte is $\ge 144$ then $e\_i < 256$ ⇒ $e'\_i=0$.
Roughly 30 % of the rows meet that test — more than enough for a full‑rank $512\times512$ sub‑matrix.

---

### Linear algebra mod $4096$

Select the **clean** indices

```python
clean_idx = [i for i, bi in enumerate(b) if (bi % 256) >= 144][:n]
```

and build the exact system

$$
A'_{\text{clean}} · s \;\equiv\; d_{\text{clean}} \pmod{4096},
$$

where each equation is noise‑free.

#### Solving over Z/2^12

Modulo a power of two the ring is not a field, but *odd* numbers are still units.
A plain Gaussian elimination that always pivots on an odd entry gives the unique solution $s\pmod{4096}$.

The function `solver()` below implements exactly that.

---

### Decrypting the ciphertext

Every ciphertext contains a pair $(\sum a\_i,; \text{sum }b\_i)$.
Because each $a\_i$ is again a multiple of 256, the inner product that shows up during decryption depends **only** on $s\pmod{4096}$, which we now possess.

After subtracting that inner product the remaining value is either

* close to $0$  or
* close to $q/2 = 524,288$,

with an error bounded by $\le |S|·399 \ll q/4$.
A single comparison therefore recovers each plaintext bit with certainty.

---

### Solver script

```python
from sage.all import *

# constants 
q  = 2**20
cf = 256
qp = q // cf                 

from output import q as q_, n, m, c, A, b, flag_ciphertext
A = [[int(x) for x in row] for row in A]
b = [int(x) for x in b]


clean = [i for i, bi in enumerate(b) if (bi % cf) >= 144][:n]
A_cl = [[(A[i][j] // cf) % qp for j in range(n)] for i in clean]
d_cl = [((b[i] - (b[i] % cf)) // cf) % qp for i in clean]


def solve_mod2k(mat, vec, mod=4096):
    M   = [row[:] for row in mat]
    rhs = vec[:]
    r = 0
    rows, cols = len(M), len(M[0])
    for c in range(cols):
        pivot = next((k for k in range(r, rows) if M[k][c] & 1), None)
        if pivot is None:
            continue
        if pivot != r:
            M[r], M[pivot] = M[pivot], M[r]
            rhs[r], rhs[pivot] = rhs[pivot], rhs[r]
        inv = Integer(M[r][c]).inverse_mod(mod)
        M[r]  = [(x * inv) % mod for x in M[r]]
        rhs[r] = (rhs[r] * inv) % mod
        for k in range(rows):
            if k == r or M[k][c] == 0:
                continue
            f = M[k][c]
            M[k]  = [(M[k][j] - f * M[r][j]) % mod for j in range(cols)]
            rhs[k] = (rhs[k] - f * rhs[r]) % mod
        r += 1
        if r == cols:
            break
    sol = [0]*cols
    for i in range(r):
        lead = next(j for j, x in enumerate(M[i]) if x == 1)
        sol[lead] = rhs[i]
    return sol

s_mod = solve_mod2k(A_cl, d_cl, qp)      

def bit(ct, s4096):
    a_sum, c2 = ct
    a_red = [int(x)//cf for x in a_sum]
    prod  = sum(ai*si for ai,si in zip(a_red, s4096)) % qp
    inner = (prod * cf) % q
    diff  = (int(c2) - inner) % q
    return 0 if diff < q//4 or diff > 3*q//4 else 1

bits = [bit(ct, s_mod) for ct in flag_ciphertext]
flag = bytes(sum(bits[i+k]<<k for k in range(8))
             for i in range(0, len(bits), 8)).decode(errors='ignore')
print(flag)
```

**FLAG : `IERAE{b4ndw1d7h_54v1ng_c1ph3r}`**

---

### Take‑aways

* Truncating the low bits of $A$ leaks *structure* that survives in the public key.
* Dividing by that common factor moves us to a tiny modulus where the noise collapses to 0 or 1.
* Selecting the right equations turns LWE into **plain linear algebra**.
* Over powers of two, odd coefficients are still invertible ⇒ classic elimination works.


