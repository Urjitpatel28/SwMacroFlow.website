# SwMacroFlow

SwMacroFlow runs one or more SOLIDWORKS macros across many parts, assemblies and drawings
without anyone sitting in front of the screen. It opens each file once, runs every macro you ticked
against it in order, closes it, and records what each macro reported.

It is a separate application that drives SOLIDWORKS from outside. Start it from the Start menu. It
joins a SOLIDWORKS you already have open, or starts one for you if none is running - the window says
which while it works that out. Nothing is installed into SOLIDWORKS itself.

## What it is for

- Applying the same change to a folder of files - a template swap, a unit change, a property update.
- Exporting a folder of files - PDF, DXF, STEP, a BOM.
- Checking a folder of files and reporting on it, without changing anything.
- Running a macro that does its own thing once, with no file open at all.

If you already have a macro that works on one open document, it will almost certainly work here with
no changes. See *Writing a macro*.

## Before you start

Two machine settings matter more than anything else:

- **Trust access to the VBA project object model** must be on in the SOLIDWORKS VBA editor
  (Tools → Options → Security → Trust Center → Macro Settings). Without it, macros fail to load
  with a clear message. See *Troubleshooting*.
- **Run SwMacroFlow the same way you run SOLIDWORKS.** If one is elevated as administrator and the
  other is not, Windows hides them from each other and connection fails. Start both normally, or
  both elevated - not mixed.

SOLIDWORKS must be installed and licensed for the Windows user running SwMacroFlow. If SwMacroFlow
starts SOLIDWORKS because none was running, that instance takes a license seat like opening
SOLIDWORKS yourself would.

## How a run works

This is the whole model, and everything else follows from it:

1. Before the first file opens, every ticked macro is prepared and checked.
2. For each file in scope, in turn:
   - SOLIDWORKS opens the file.
   - Each ticked macro runs against it, **in list order**.
   - The file is closed. Unsaved changes are discarded, so a macro that changes something must save
     it.
3. Each macro-file pair produces exactly one row in the results list.

The file is opened **once** per pass, not once per macro. Three macros over 200 files means 200
opens, not 600 - and opening is by far the slowest part of a batch. That is the reason to put
several macros in one job rather than running three jobs.

Files are processed strictly one at a time, and so are the macros within a file. SOLIDWORKS
automation is single-session, so there is no parallel mode to turn on.

## Two ways to run

| Mode | Button | What happens |
|---|---|---|
| Batch | **Run Batch** | The chain runs once per file in scope. This is the normal mode. |
| Run once | **Run Once** | The chain runs a single time with nothing opened and nothing closed. Tick **Run once without opening any files** in the Scope panel. |

Run once is for a macro that does not act on a file handed to it - it generates a report, walks a
folder itself, or sets application options. In that mode there is no active document, so the macro
must not rely on `ActiveDoc`, and input values must not use `{Property}` placeholders.

## Quick start

1. **Add your macros.** **Add Macro...** to browse to a `.swp`, or **From Library** to pick one that
   ships with SwMacroFlow. Each is checked as soon as it loads, so a macro that will not compile
   tells you now rather than on file 200.
2. **Choose the files.** Scan a folder, add files directly, or drag and drop them in.
3. **Fill in the inputs.** Click a macro in the list to see its inputs. Each macro keeps its own.
   Free-text fields may include `{PropertyName}` tokens that resolve per document - see *Using the
   app* and *Adding inputs*.
4. **Run.** Rows appear as each macro finishes each file.
5. **Read the results.** Green passed, amber means the macro asked a question nobody could answer,
   red failed, grey was skipped.

Panel-by-panel detail is in *Using the app*.

## What authors need to know

| Guide | Contents |
|---|---|
| *Writing a macro* | Entry point, `ActiveDoc`, save-before-close, temp copy |
| *Adding inputs* | `"@Name"` declarations, types, validation, `{Property}` placeholders |
| *Reporting a result* | `MsgBox` → green / amber / red rows |
| *Macro authoring spec* | The full contract in one pasteable document for AI assistants |

## This Help page

The **?** button rebuilds and opens this Help. It is the seven guides only. Per-macro descriptions
that appear as tooltips under **From Library** live beside the library macros and are not part of
this page.

## Words used in these guides

| Term | Meaning |
|---|---|
| Macro | One `.swp` file. The unit you add to a job. |
| Chain | The ticked macros in list order. Every file goes through the whole chain. |
| Scope | The files the batch will run against - the lists plus the Part / Assembly / Drawing filters. |
| Input | A value the macro declares and you fill in before the run. See *Adding inputs*. |
| `{Property}` | A placeholder in a free-text input value, resolved from the open document's custom properties. |
| `{FileName}` | The one reserved placeholder name - always the open document's filename without its extension. |
| Row | One line in the Results panel: one macro, one file, one outcome. |
| Run once | The mode that runs the chain a single time with no document open. |
