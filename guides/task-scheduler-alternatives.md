# SOLIDWORKS Task Scheduler alternatives

If you have gone looking for a way to batch process SOLIDWORKS files and found that Task Scheduler
will not do what you need, you are in a well-worn groove. The threads asking this question go back
more than a decade, most of them on the old SOLIDWORKS forum that has since been retired, and the
answer they all arrive at - use #TASK, it is free - stopped being true on 1 May 2020.

This page is an honest survey of what is actually available now, what each option can and cannot do,
and how to pick. SwMacroFlow is one of the options and we make it, so read the comparison table with
that in mind. The limitations listed against it are real ones.

## What SOLIDWORKS Task Scheduler actually does

Task Scheduler ships with SOLIDWORKS Professional and Premium. On SOLIDWORKS Standard it is either
absent or reduced to a small subset depending on your version, which is the first thing that stops
most people - a Standard seat is not a licence tier that gets to batch process.

Where it is available, it handles a fixed menu of jobs:

- Print a set of drawings
- Convert drawings to DXF or DWG
- Export to eDrawings
- Update files to the current SOLIDWORKS version
- Run Pack and Go
- Import and export a small set of formats
- Run a custom task

That list is the whole product. Each entry is a dialog with its own options, and there is no way to
add a new kind of job to the menu.

Three limits send people looking for something else:

**Parts cannot be exported to DXF.** The DXF and DWG task takes drawings only. Batch-exporting flat
patterns of sheet metal parts - probably the single most requested batch job in the SOLIDWORKS world
- is not something Task Scheduler will do.

**Run Custom Task is not what it sounds like.** It runs a macro, but the macro has to be written
against the Task Scheduler scheduling interface rather than being an ordinary macro that works on the
open document. Taking a macro that already works and making it run here is a rewrite, not a
drag-and-drop.

**Nothing chains.** Each task is independent. If you want to set a custom property, rebuild, and then
export to PDF, that is three separate scheduled tasks each opening and closing every file again.

Task Scheduler is genuinely good at the things on its menu, especially version upgrades across a
large legacy folder. It is just a fixed menu.

## What happened to #TASK

#TASK, from Central Innovation, was the tool the community settled on. It ran ordinary macros across
folders, converted files, renamed properties in bulk, and it was free. Enough people relied on it
that "just use #TASK" was the standard forum answer for years.

It moved to a paid model on 1 May 2020. The free version was withdrawn. Those old forum answers are
still the top results for these searches, which is why so many people arrive at a download page that
no longer offers what the thread promised.

Nothing free stepped directly into the gap at the time, and that is the reason this page exists.

## The options today

| Tool | Cost | Runs your own macros | Chains macros | Parts to DXF | Scheduling |
|---|---|---|---|---|---|
| SOLIDWORKS Task Scheduler | Included with Pro and Premium | Only if rewritten for its interface | No | No | Yes |
| #TASK | Paid | Yes | Yes | Yes | Yes |
| Batch+ (Xarial CAD+ Toolset) | Free, open source | Yes | Yes | Via your macro | Via Windows |
| Drew (CAD Booster) | Paid | Yes | Yes | Via your macro | No |
| SwMacroFlow | Free | Yes | Yes | Via your macro | Yes |

Check current pricing with each vendor before deciding - the paid tools change terms, and this table
records what we understood at the time of writing.

### Batch+, from the Xarial CAD+ Toolset

Batch+ is free, open source, and the closest thing to a direct #TASK replacement that existed before
we built ours. It is a standalone application that runs specified macros against specified models,
and it monitors SOLIDWORKS for crashes and restarts it when one happens - which matters more than it
sounds like on a batch of several hundred files.

It comes from the same author as CodeStack, which is the best SOLIDWORKS API reference on the
internet, and the engineering is solid. If you are comfortable with a command-line-flavoured workflow
and want something proven, it is a good answer.

### Drew, from CAD Booster

Drew is a paid SOLIDWORKS add-in with a batch tool that lets you select tasks and models and run
every task across every model. It is an add-in rather than a standalone application, so it lives
inside SOLIDWORKS and works the way an add-in works: you have SOLIDWORKS open, and you are driving
it.

If you want batch processing bundled with a broader set of productivity tools and you are happy
paying for it, it is a reasonable buy.

### A macro with the folder loop written into it

Worth stating plainly, because it is free and it works: you can write the file loop into the macro
itself. Open a folder with `Dir`, iterate, open each document, do the work, close it. There is a
complete worked example in the guide to
[running a macro on multiple files](/guides/run-macro-on-multiple-files/).

This is the right answer for a one-off. It becomes the wrong answer when you want to reuse the same
task-specific logic with different file sets, or combine two jobs, because the loop and the work are
now welded together in one file.

### SwMacroFlow

We built SwMacroFlow because the specific combination we wanted did not exist: free, no account, runs
ordinary unmodified macros, and chains several of them per file.

It is a standalone Windows application, not an add-in. It attaches to an installed, licensed x64
SOLIDWORKS session over COM, or starts one, and nothing is registered inside SOLIDWORKS itself. It
installs per user with no administrator rights.

The model is: pick files or a folder, pick the macros you want in the order you want them, run. Each
file opens once, every selected macro runs against it in order, then the file closes and the batch
moves to the next one. A macro's `MsgBox` calls become that file's row in the results list rather
than a dialog that stops the batch. It also creates real Windows Task Scheduler entries for
unattended runs, and can spread one batch across two to four SOLIDWORKS instances.

Any SOLIDWORKS VBA macro with an argument-less `Sub main` works with no changes. See
[writing a macro](/docs/writing-a-macro/) for what that means in practice, and
[using the app](/docs/using-the-app/) for a panel-by-panel walkthrough of a run.

Its real limitations: it is Windows-only, it needs a licensed x64 SOLIDWORKS installed on the same
machine, the installer is unsigned so Windows SmartScreen will warn you the first time, and it is a
young project - much younger than Batch+ or #TASK.

## How to choose

**You are on SOLIDWORKS Professional or Premium and your job is on the Task Scheduler menu.** Use
Task Scheduler. It is already there and your reseller supports it.

**You need one thing once.** Write the folder loop into the macro. Half an hour of VBA beats
installing anything.

**You need to run your own macros across folders repeatedly, and you want it free.** Batch+ or
SwMacroFlow. Batch+ is more mature; SwMacroFlow chains macros per file and has a more conventional
desktop interface. Both are free, so trying both costs you an afternoon.

**You want batch processing as part of a supported commercial toolset.** #TASK or Drew.

## FAQ

### Is SOLIDWORKS Task Scheduler available in SOLIDWORKS Standard?

Not fully. Task Scheduler is a Professional and Premium feature; on Standard it is either unavailable
or restricted to a small subset of tasks depending on your version. This is the most common reason
people go looking for an alternative in the first place.

### Is #TASK still free?

No. #TASK moved to a paid model on 1 May 2020. The forum threads recommending it as a free tool
predate that change, which is why they are misleading now.

### Can SOLIDWORKS Task Scheduler batch export parts to DXF?

No. Its DXF and DWG conversion task accepts drawings only. Exporting sheet metal flat patterns from
parts in bulk needs a macro, and therefore something that can run a macro across a folder.

### Do I need a SOLIDWORKS add-in to batch process files?

No, and there is a good argument that an add-in is the wrong shape for the job. An out-of-process
application can restart SOLIDWORKS after a crash, which an add-in living inside that process cannot.
This is covered in full in
[do you need a SOLIDWORKS add-in](/guides/do-you-need-a-solidworks-add-in/).

### Will my existing macro work in one of these tools without changes?

In SwMacroFlow and Batch+, generally yes, provided it operates on the currently open document and has
an argument-less entry point. In Task Scheduler's custom task, generally no - that interface expects
a macro written against it.

### Can I batch process without SOLIDWORKS installed?

No. Every tool here, including all the paid ones, drives a real installed SOLIDWORKS session. They
automate the application you already have; none of them reads or writes SOLIDWORKS files on its own.
