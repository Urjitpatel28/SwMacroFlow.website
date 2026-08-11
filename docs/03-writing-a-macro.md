# Writing a macro

Any SOLIDWORKS VBA macro with an argument-less `Sub main` works. There is no SwMacroFlow-specific
code to add, no library to reference, and no result object to fill in. A macro written for
SwMacroFlow still runs by hand in the VBA editor exactly as it always did.

```vb
Option Explicit

Sub main()
    Dim swApp As SldWorks.SldWorks
    Dim model As SldWorks.ModelDoc2

    Set swApp = Application.SldWorks
    Set model = swApp.ActiveDoc      ' the file SwMacroFlow just opened

    If model Is Nothing Then Exit Sub

    ' Restrict to the document type this macro makes sense for, if needed:
    ' If model.GetType <> swDocDRAWING Then
    '     MsgBox "Not a drawing, skipped"
    '     Exit Sub
    ' End If

    ' ---- your per-file work here ----
    ' If you change the document, save it before returning.
    ' Report with MsgBox - see Reporting a result.
End Sub
```

Inputs are declared as `Const` values with `"@Name"` tokens - see *Adding inputs*. For the complete
contract in one place (including property placeholders), see *Macro authoring spec*.

## The entry point

SwMacroFlow looks for a `Sub` that takes **no arguments**:

- A `Sub` named `main` is preferred, whatever **standard module** it is in. Case does not matter.
- If there is no `main`, the **first** argument-less `Sub` is used - and which one that is depends on
  the order SOLIDWORKS happens to list them, which you do not control.

**Always name your entry point `main`.** It is the only way to be sure which procedure runs.

A macro with no argument-less `Sub` at all is rejected when you add it, with *"This macro has no
runnable procedure"*.

## How your macro sees the file

SwMacroFlow opens the file, makes it the active document, and calls your `Sub`. The file is never
passed in as an argument - `swApp.ActiveDoc` is how you reach it.

Guard for `Nothing` and exit cleanly. It costs one line and it is the difference between a clear row
and `Error 91: Object variable or With block variable not set`.

`model.GetType` tells you what you were handed, if the macro only makes sense for one kind of
document:

```vb
If model.GetType <> swDocDRAWING Then
    MsgBox "Not a drawing, skipped"
    Exit Sub
End If
```

## Your macro runs once per file

The same `Sub` is called again for the next file, in the same VBA session. That has two
consequences worth knowing:

- **Do not cache per-file state in a module-level variable** unless you reset it at the top of
  `main`. Whatever the last file left behind is still there.
- **Save what you change.** SwMacroFlow closes the document when the chain is done with it, and
  closing discards unsaved changes.

When several macros are in the chain, each file is opened **once**. Every ticked macro runs against
that open document in list order, then the file closes. Do not open or close documents yourself in
batch mode - the host does it.

## Running with no document

A macro that does its own work needs no document at all. Leave out `ActiveDoc`, tick **Run once
without opening any files** in the Scope panel, and the macro runs a single time with nothing opened
or closed - useful for a report, a folder walk, or setting application options.

Inputs and `MsgBox` reporting work exactly the same. `ActiveDoc` returns `Nothing` in this mode, so a
macro that needs a document will simply exit at its guard.

Do not use `{Property}` placeholders in input values in this mode - there is no document to resolve
them against. See *Adding inputs*.

## Your `.swp` is never modified

Each run works on a throwaway copy in `%TEMP%\SwMacroFlow\`. That copy is where SwMacroFlow puts
your input values and the machinery that captures your results. Open your own macro in the VBA
editor any time and it is exactly as you wrote it.

Two things follow from this:

- `GetCurrentMacroPathName` inside your macro reports that temporary location, not where you saved
  it. Do not use it to find files next to your macro - use a `FilePath` or `FolderPath` input
  instead.
- The copy is deleted at the end of the batch. Copies left behind by a crash are swept up an hour
  later, on the next run.

## Checking it works

1. Run the macro once by hand from the VBA editor before batching it. It behaves identically there,
   with one difference: `MsgBox` shows a real dialog instead of writing to the results list.
2. Add it to a job with a single file in scope and run that. If it is going to fail, it should fail
   on one file, not on four hundred.
3. Use `Option Explicit` and compile with Debug → Compile in the VBA editor so load-time surprises
   are fewer.

For how to expose typed inputs and `{Property}` patterns, see *Adding inputs*. For how results become
green, amber or red rows, see *Reporting a result*.
