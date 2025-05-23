---
title: "UIUCTF 2023 - Group Project/ion"
description: "Small Subgroup Confinement attack"
date: 'Nov 17 2023'
tags: ['writeup', 'uiuctf23', 'crypto']
authors: ['ctfguy']
---

## Group Project


### Description:

>In any good project, you split the work into smaller tasks...



| **Category** | **Points** | **Author** |
| --- | --- | --- |
| Cryptography | 50 | Anakin |


### Remote:

>nc group.chal.uiuc.tf 1337



### Challenge File

#### Chall.py

```py
from Crypto.Util.number import getPrime, long_to_bytes
from random import randint
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


with open("/flag", "rb") as f:
    flag = f.read().strip()

def main():
    print("[$] Did no one ever tell you to mind your own business??")

    g, p = 2, getPrime(1024)
    a = randint(2, p - 1)
    A = pow(g, a, p)
    print("[$] Public:")
    print(f"[$]     {g = }")
    print(f"[$]     {p = }")
    print(f"[$]     {A = }")

    try:
        k = int(input("[$] Choose k = "))
    except:
        print("[$] I said a number...")

    if k == 1 or k == p - 1 or k == (p - 1) // 2:
        print("[$] I'm not that dumb...")

    Ak = pow(A, k, p)
    b = randint(2, p - 1)
    B = pow(g, b, p)
    Bk = pow(B, k, p)
    S = pow(Bk, a, p)

    key = hashlib.md5(long_to_bytes(S)).digest()
    cipher = AES.new(key, AES.MODE_ECB)
    c = int.from_bytes(cipher.encrypt(pad(flag, 16)), "big")

    print("[$] Ciphertext using shared 'secret' ;)")
    print(f"[$]     {c = }")


if __name__ == "__main__":
    main()


```





### Understanding the challenge 


This challenge implements a simplified version of the Diffie-Hellman exchange protocol. 

First it generates the public parameters for the Diffie-Hellman key exchange: `g`, `p`, and `A`. `g` is set to `2`, while `p` is generated as a random `1024-bit` prime number using the getPrime function. A random integer `a` is then generated between `2` and `p-1`, and `A` is calculated as `g^a mod p`.

It then ask us to enter a value `k` which has some restrictions. If the value of `k` is `1`, `p-1`, or `(p-1)/2`, an error message is printed. 

Then it calculate the shared secret using the Diffie-Hellman key exchange algorithm. First, `Ak` is calculated as `A^k mod p`. Then, a random integer `b` is generated between `2` and `p-1`, and `B` is calculated as `g^b mod p`. Next, `Bk` is calculated as `B^k mod p`, and finally, the shared secret `S` is calculated as `Bk^a mod p`.

The shared secret is then used to derive an encryption key by taking its MD5 hash and using it as the key for an AES cipher in ECB mode.

The contents of the /flag file are encrypted using this cipher and converted to an integer value, which is stored in the variable c.

The ciphertext (the encrypted value of /flag) is then printed.


### Analysis

This is a CTF challenge and our task is to find the flag. From the code we know the following details.

* Value of `g`, `p`, and `A` 
* Value of `k` cannot be `1` ,`p-1`, or `(p-1)/2`

What we don't know:

* Value of `a` , `b` and `S` .

It is understood that without knowing the value of `S`, we actually decrypt the secret message.

So if we look at `S`, we can note that `Bk` , `a` and `p` are the values responsible for the `S` value. 

We know that `a` is random ,also we don't have control over any of the value expect `k` which indeed can be used to manipulate the value of `Bk` (i.e `Bk = B^k mod p`). 

So by inspection we can note that we know the value of `Bk` can be equal to `1` when `k = 0` and this value of `k` is allowed by the code, which results in know value of `S=1`

So this can be used now to decrypt the cipher text given by the code.

### Maths involved

When `k = 0`

$$ 
\begin{aligned}
\mathrm Bk = B^0\ \bmod\ p\ =\ 1\ \bmod\ p\ =\ 1  
\end{aligned}
$$

$$ 
\begin{aligned}
\implies \mathrm S = 1^a\ \bmod\ p\ =\ 1\ \bmod\ p\ =\ 1  
\end{aligned}
$$

**NOTE:**
There was an unintended solve where `k=p-1` also worked here which actually shouldn't be possible. 

Reson why `k = p-1` works mathematically is:

By Fermat’s Little Theorem if `p` is a prime number and `a` is an integer not divisible by `p`, then `a^(p-1) ≡ 1 (mod p)`. In other words, if you raise `a` to the power of `p-1` and then take the remainder when dividing by `p`, the result will always be `1`.

So by substituting `k = p-1`

$$ 
\begin{aligned}
\mathrm Bk = B^{(p-1)}\ \bmod\ p  
\end{aligned}
$$

$$ 
\begin{aligned}
\mathrm S = \big(B^{(p-1)}\big)^a\ \bmod\ p\ =\ 1\ \bmod\ p\ =\ 1 
\end{aligned}
$$




### Solve Script

```py
from pwn import *
from Crypto.Util.number import long_to_bytes
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import hashlib

conn = remote('group.chal.uiuc.tf', 1337)

conn.recvuntil("[$] Did no one ever tell you to mind your own business??")

response = conn.recvuntil("Choose k =").decode()
g = int(response.split("g = ")[1].split("\n")[0])
p = int(response.split("p = ")[1].split("\n")[0])
A = int(response.split("A = ")[1].split("\n")[0])
k = p - 1  #can be 0 too. 
conn.sendline(str(k))
conn.recvuntil("\n")
response = conn.recvuntil("\n")
ciphertext=response.decode().split("c = ")[1].split("\n")[0]
c=int(ciphertext)
S = 1 
key = hashlib.md5(long_to_bytes(S)).digest()  
cipher = AES.new(key, AES.MODE_ECB)

flag = unpad(cipher.decrypt(long_to_bytes(c)), 16)  
print(flag)

conn.close()
```

### Output/Flag:

`uiuctf{brut3f0rc3_a1n't_s0_b4d_aft3r_all!!11!!}`


**This was part just part one, now comes the interesting version of it - Group Projection**


## Group Projection

### Description: 

> I gave you an easier project last time. This one is sure to break your grade!



|**Category** | **Points** | **Author** |
| --- | --- | --- |
|Cryptography | 50 | Anakin|

### Remote:
> nc group-projection.chal.uiuc.tf 1337


### Challenge File

### Chall.py 

```py
from Crypto.Util.number import getPrime, long_to_bytes
from random import randint
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


with open("/flag", "rb") as f:
    flag = f.read().strip()

def main():
    print("[$] Did no one ever tell you to mind your own business??")

    g, p = 2, getPrime(1024)
    a = randint(2, p - 1)
    A = pow(g, a, p)
    print("[$] Public:")
    print(f"[$]     {g = }")
    print(f"[$]     {p = }")
    print(f"[$]     {A = }")

    try:
        k = int(input("[$] Choose k = "))
    except:
        print("[$] I said a number...")
        return
    if k == 1 or k == p - 1 or k == (p - 1) // 2 or k <= 0 or k >= p:
        print("[$] I'm not that dumb...")
        return

    Ak = pow(A, k, p)
    b = randint(2, p - 1)
    B = pow(g, b, p)
    Bk = pow(B, k, p)
    S = pow(Bk, a, p)

    key = hashlib.md5(long_to_bytes(S)).digest()
    cipher = AES.new(key, AES.MODE_ECB)
    c = int.from_bytes(cipher.encrypt(pad(flag, 16)), "big")

    print("[$] Ciphertext using shared 'secret' ;)")
    print(f"[$]     {c = }")
    return

if __name__ == "__main__":
    main()

```

### Overview

As you can see from the challenge file, this code almost does the same thing as the previous challenge with some additional restrictions. 

```py

try:
        k = int(input("[$] Choose k = "))
    except:
        print("[$] I said a number...")
        return
    if k == 1 or k == p - 1 or k == (p - 1) // 2 or k <= 0 or k >= p:
        print("[$] I'm not that dumb...")
        return

```

So this fixes the previous weakness that we exploited to get the flag. 

### Analysis 

It can be noted that the previous approach of `k=0` won't work here. 

When `k != 0` the value of `s` is not know. So our problem lies on not able to predict the value of `s` . However we have control over the input `k` .

Thinking this way and some discussion with others + research on the internet lead me to a well know attack known as the [Small Subgroup Confinement Attack](https://crypto.stackexchange.com/questions/27584/small-subgroup-confinement-attack-on-diffie-hellman). 

Now lets try to work on this approach. 

### Mathematical approach

In the given challenge code, `p` is a large prime number and `g` is a [generator](https://crypto.stackexchange.com/questions/16196/what-is-a-generator) of the multiplicative group of integers modulo `p` This group is denoted by $\mathbb{Z/p\mathbb Z^*}$ and consists of all integers between `1` and `p-1` that are relatively prime to `p`. The order of this group is `p-1` , which is not prime. This means that there exist subgroups of smaller order.

Let’s say `Gw` is one such small subgroup of order `w` . This means that `Gw` consists of all elements `x` in $\mathbb{Z/p\mathbb Z^*}$ such that $\mathrm{x^w = 1 (\bmod\ p)}$ . In other words, `Gw` consists of all the w-th roots of unity modulo `p`.

By picking $\mathrm{k = (p-1)/w}$, the secret value `S` will be confined to the small subgroup `Gw` . This is because raising any element of the group to the power of `(p-1)/w` will map it to an element of `Gw` .

To see why this is true, let’s consider an arbitrary element `x` in $\mathbb{Z/p\mathbb Z^*}$ . By Fermat’s Little Theorem, we know that
$$
\begin{aligned}
x^{(p-1)} = 1 (\bmod\ p)
\end{aligned}
$$

$$
\begin{aligned}
\implies \mathrm(x^{((p-1)/w)})^{w} = x^{(p-1)} = 1 (\bmod\ p) 
\end{aligned}
$$ 

In other words, raising any element of the group to the power of `(p-1)/w` will map it to an element of `Gw`

The shared secret `S` is computed as `S = pow(Bk, a, p)` , which is equivalent to $\mathrm{(B^{k})^{a} = B^{(ka)} }$ . Since both `Bk` and `a` are elements of  $\mathbb{Z/p\mathbb Z^{*}}$ , their product will also be an element of  $\mathbb{Z/p\mathbb Z^{*}}$ . Furthermore, since both `Bk` and `a` are elements of `Gw` , their product will also be an element of `Gw` . This means that the shared secret `S` is confined to the small subgroup `Gw` .

Since `Gw` is a small subgroup, it is possible to find the value of `S` by exhaustive search efficiently. Once we found the value of `S` , we can use it to compute the key and decrypt the ciphertext to obtain the flag. 



### Solve Script

```py
from pwn import *
from Crypto.Util.number import long_to_bytes
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
import gmpy2

conn = remote('group-projection.chal.uiuc.tf', 1337)

print(conn.recvuntil("[$] Did no one ever tell you to mind your own business??"))

response = conn.recvuntil("Choose k =").decode()
g = int(response.split("g = ")[1].split("\n")[0])
p = int(response.split("p = ")[1].split("\n")[0])
A = int(response.split("A = ")[1].split("\n")[0])

#print(f'p = {p}')

w = 2
while True:
    if (p-1) % w == 0 and w!=2:
        break
    w += 1

#print(w)

k = (p-1) // w

conn.sendline(str(k))
conn.recvuntil("\n")
response = conn.recvuntil("\n")
#print(response)
ciphertext=response.decode().split("c = ")[1].split("\n")[0]
c=int(ciphertext)


for i in range(w):
    S = pow(g, i*(p-1)//w, p)
    key = hashlib.md5(long_to_bytes(S)).digest()
    cipher = AES.new(key, AES.MODE_ECB)
    c_bytes = long_to_bytes(c)
    
    try:
        flag = unpad(cipher.decrypt(c_bytes), 16)
        if b"uiuctf" in flag:
            #print(S)
            print(flag)
            break
    except ValueError:
        continue

conn.close()
```

In this code, we are finding a small divisor `w` of `p-1` and computing k as `(p-1)//w` . We then use this value of `k` to compute all possible values for `S` as powers of `g^((p-1)//w)`. For each possible value of `S` , you compute the key and try to decrypt the ciphertext. If the decryption is successful and the decrypted message contains the string `"uiuctf"` , then you have found the correct value for `S`

#### Addition NOTE

While solving this problem I came across serveral problem , but here is one particular problem that is worth mentioning and which i feel will be useful to others.

The above solve script and approach almost every time and the main reason is this part of the code: 

```py 
    try:
        flag = unpad(cipher.decrypt(c_bytes), 16)
        if b"uiuctf" in flag:
            #print(S)
            print(flag)
            break
    except ValueError:
        continue

```

<br>

AES encryption operates on blocks of fixed size (16 bytes for AES-128). This means that the plaintext message must be padded to a multiple of the block size before encryption. The most common padding scheme used with AES is `PKCS#7` padding, which appends n bytes with value `n` to the end of the message, where `n` is the number of padding bytes needed to reach the next multiple of the block size.

When decrypting a ciphertext, the padding must be removed to recover the original plaintext message. This is done by checking the value of the last byte of the decrypted message and removing that many bytes from the end of the message. If the value of the last byte is not valid (i.e., it is greater than the block size or any of the padding bytes have a different value), then a ValueError is raised to indicate that the padding is invalid.

The issue arises when we are trying to decrypt a ciphertext using an incorrect key. In this case, there is a small chance (roughly 1/255) that the decrypted message will have valid `PKCS#7` padding by chance. This means that the unpad function will not raise a ValueError and will return a garbage message instead.

In the solve script, we are iterating over all possible values for `S` and trying to decrypt the ciphertext using each possible key. If we come upon one of these false positives before finding the true key, then we will get a garbage message instead of the flag.

To address this issue, I added the additional check to verify that the decrypted message is indeed the flag with the above portion of code I mentioned

This additional check helps us reduce the chance of false positives and ensures that you always find the correct flag.

Example cases which doesn't work without the check (if you want to try):

```
p = 162907633221903289584356781557375994961174978509211656260257389469814226640109152696955415642694377783466971489174143258453196806651345265182960290730869903347731913995646004000745040447319942694780711975418089332060722988980844312887593315120423289084427928304631707985936917385442686411645456681662934670986

w = 111491

c = 5614285933234928579813206915174147905155599175501429976949786286882318420184919316773690688181649831808487446027720935384871288253563164886912265574524344

```



<br>





