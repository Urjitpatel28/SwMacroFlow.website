# Batch processing beyond SOLIDWORKS Task Scheduler

If you have gone looking for a way to batch process SOLIDWORKS files and found that Task Scheduler
will not do what you need, you are in a well-worn groove. The question has been asked on forums for
more than a decade, and it usually comes down to the same three limits.

This page explains what Task Scheduler does well, where it stops, and the two ways past those limits:
writing the file loop into a macro yourself, or handing the loop to a separate batch runner. We make
SwMacroFlow, which is one such runner, so it is described here in some detail - including what it
cannot do.

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

Task Scheduler is genuinely good at the things on its menu, especially version upgrades across a
large legacy folder. If your job is on the menu and you have Professional or Premium, use it - it is
already installed and your reseller supports it.

## Where it stops

Three limits send people looking for something else.

**Parts cannot be exported to DXF.** The DXF and DWG task takes drawings only. Batch-exporting flat
patterns of sheet metal parts - probably the single most requested batch job in the SOLIDWORKS
world - is not something Task Scheduler will do.

**Run Custom Task is not what it sounds like.** It runs a macro, but the macro has to be written
against the Task Scheduler scheduling interface rather than being an ordinary macro that works on the
open document. Taking a macro that already works and making it run here is a rewrite, not a
drag-and-drop.

**Nothing chains.** Each task is independent. If you want to set a custom property, rebuild, and then
export to PDF, that is three separate scheduled tasks, each opening and closing every file again.

All three have the same root: the menu decides what work is possible. Getting past them means
running your own macro against every file, and something has to supply the loop.

## Option 1: write the folder loop into the macro

Worth stating plainly, because it is free and it works: you can write the file loop into the macro
itself. Open a folder with `Dir`, iterate, open each document, do the work, close it. There is a
complete worked example in the guide to
[running a macro on multiple files](/guides/run-macro-on-multiple-files/).

This is the right answer for a one-off. It becomes the wrong answer when you want to reuse the same
task-specific logic with different file sets, or combine two jobs, because the loop and the work are
now welded together in one file. It also leaves you to handle the things that go wrong on a long
run yourself: files that will not open, dialogs that stop the batch, and a SOLIDWORKS session that
slowly degrades over several hundred files.

## Option 2: a batch runner that supplies the loop

The other approach keeps your macro as it is - a script that operates on the open document - and
lets a separate application supply the file list, the open and the close. This is the approach
SwMacroFlow takes.

It is a standalone Windows application, not an add-in. It attaches to an installed, licensed x64
SOLIDWORKS session over COM, or starts one, and nothing is registered inside SOLIDWORKS itself. It
installs per user with no administrator rights, it is free, and it needs no account.

Here is how it answers each of the three limits.

**Any macro, including parts to DXF.** Any SOLIDWORKS VBA macro with an argument-less `Sub main`
works with no changes. If you have a macro that exports a sheet metal flat pattern, it runs across a
folder of parts the same way it runs on one. The [macro library](/macros.html) has ready-made macros
for common jobs if you would rather not write one. See [writing a macro](/docs/writing-a-macro/) for
what "works with no changes" means in practice.

**No rewrite for a special interface.** A macro that works when you press F5 on an open document
works in the batch. Declare a `Const` with an `@Name` token and the app builds an input control for
it, so one macro serves different folders and values without editing - see
[adding inputs](/docs/adding-inputs/).

**Macros chain per file.** Pick files or a folder, pick the macros you want in the order you want
them, run. Each file opens once, every selected macro runs against it in order, then the file closes
and the batch moves to the next one. Setting a property, rebuilding and exporting is one pass over the
folder, not three.

A few other things it does that matter on real batches:

- A macro's `MsgBox` calls become that file's row in the results list rather than a dialog that stops
  the batch. See [reporting a result](/docs/reporting-results/).
- A chain and the values typed into it can be saved as a named **workflow** and applied again next
  week, instead of being rebuilt. See [using the app](/docs/using-the-app/).
- It creates real Windows Task Scheduler entries for unattended runs, so a batch can run overnight.
- It can restart SOLIDWORKS every N files, and spread one batch across several SOLIDWORKS instances.

Its real limitations: it is Windows-only, it needs a licensed x64 SOLIDWORKS installed on the same
machine, the installer is unsigned so Windows SmartScreen will warn you the first time, and it is a
young project.

## How to choose

**Your job is on the Task Scheduler menu and you have Professional or Premium.** Use Task Scheduler.

**You need one thing once.** Write the folder loop into the macro. Half an hour of VBA beats
installing anything.

**You need to run your own macros across folders repeatedly, or several macros per file.** Use a
batch runner, so the macro stays a plain macro and the loop, the error handling and the restarts are
someone else's problem. SwMacroFlow is free, so trying it costs you an afternoon.

## FAQ

### Is SOLIDWORKS Task Scheduler available in SOLIDWORKS Standard?

Not fully. Task Scheduler is a Professional and Premium feature; on Standard it is either unavailable
or restricted to a small subset of tasks depending on your version. This is the most common reason
people go looking for another way in the first place.

### Can SOLIDWORKS Task Scheduler batch export parts to DXF?

No. Its DXF and DWG conversion task accepts drawings only. Exporting sheet metal flat patterns from
parts in bulk needs a macro, and therefore something that can run a macro across a folder.

### Do I need a SOLIDWORKS add-in to batch process files?

No, and there is a good argument that an add-in is the wrong shape for the job. An out-of-process
application can restart SOLIDWORKS after a crash, which an add-in living inside that process cannot.
This is covered in full in
[do you need a SOLIDWORKS add-in](/guides/do-you-need-a-solidworks-add-in/).

### Will my existing macro work in SwMacroFlow without changes?

Generally yes, provided it operates on the currently open document and has an argument-less entry
point. In Task Scheduler's custom task, generally no - that interface expects a macro written
against it.

### Can I save a batch setup and reuse it?

Yes. In SwMacroFlow a macro chain and its input values can be saved as a named workflow and applied
again later; the files in scope are chosen fresh each time. A batch can also be scheduled as a real
Windows Task Scheduler entry, which keeps its file list as it was when it was scheduled.

### Can I batch process without SOLIDWORKS installed?

No. Every approach here drives a real installed SOLIDWORKS session. None of them reads or writes
SOLIDWORKS files on its own.
