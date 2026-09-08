# How to run a SOLIDWORKS macro on multiple files

You have a macro that works. It does exactly what you want to the document that is open. Now you have
a folder with four hundred files in it, and running the macro four hundred times by hand is not a
plan.

There are three real ways to solve this, and they suit different situations. This page covers all
three honestly, including the one that needs no software beyond the SOLIDWORKS you already have.

## Why a macro does not just run on a folder

A SOLIDWORKS VBA macro operates on the active document. `swApp.ActiveDoc` gives it whatever is open
and in front of you, and everything the macro does flows from there. There is no built-in notion of
"and now do that again for the next file", because a macro is a script attached to a session, not a
job description.

So batching means someone has to supply the loop: open a file, run the work, close it, move on. The
three approaches below differ only in who supplies that loop.

## Option 1: Write the loop into the macro

The free answer, and the right one for a job you will do once.

VBA can enumerate a folder with `Dir`, and the SOLIDWORKS API can open and close documents. Put those
together around the work you already wrote and you have a batch.

```
Dim swApp As SldWorks.SldWorks

Sub main()

    Set swApp = Application.SldWorks

    Const FOLDER_PATH As String = "C:\Work\Parts\"

    Dim paths() As String
    Dim count As Long
    Dim name As String

    ReDim paths(0 To 4999)
    count = 0

    ' Collect every name BEFORE opening anything. Dir keeps a single internal
    ' cursor, so calling it again from inside the processing loop restarts the
    ' enumeration and you get an infinite loop over the first file.
    name = Dir(FOLDER_PATH & "*.sldprt")
    Do While name <> ""
        paths(count) = FOLDER_PATH & name
        count = count + 1
        name = Dir
    Loop

    Dim i As Long
    Dim swModel As SldWorks.ModelDoc2
    Dim title As String
    Dim errs As Long, warns As Long
    Dim done As Long

    For i = 0 To count - 1

        Set swModel = swApp.OpenDoc6(paths(i), swDocPART, _
            swOpenDocOptions_Silent, "", errs, warns)

        If Not swModel Is Nothing Then
            title = swModel.GetTitle
            DoTheWork swModel
            swApp.CloseDoc title
            done = done + 1
        End If

    Next i

    MsgBox done & " of " & count & " files processed."

End Sub

' Whatever your macro already did to the open document goes in here.
Private Sub DoTheWork(swModel As SldWorks.ModelDoc2)

    Dim errs As Long, warns As Long
    Dim target As String

    target = Left(swModel.GetPathName, InStrRev(swModel.GetPathName, ".")) & "step"
    swModel.Extension.SaveAs target, 0, 0, Nothing, errs, warns

End Sub
```

Three things in that code are worth understanding, because they are where hand-rolled batch macros
usually go wrong.

**Collect the filenames first.** `Dir` maintains one internal cursor for the whole VBA session. If
anything inside your loop calls `Dir` again - and plenty of helper code does, for checking whether an
output file already exists - the enumeration restarts and your loop never ends. Reading every name
into an array before you open a single document removes the whole class of bug.

**Close by title, not by path.** `CloseDoc` wants the document name as SOLIDWORKS knows it. Capture
`GetTitle` before you do the work, because the work may change it - a Save As certainly will.

**Check for `Nothing`.** `OpenDoc6` returns `Nothing` when a file is corrupt, locked by someone else,
or from a future version. Without the check, the next line throws and the batch stops on file 37 of
400 with no record of what happened.

Change `swDocPART` and `*.sldprt` together to work on assemblies (`swDocASSEMBLY`, `*.sldasm`) or
drawings (`swDocDRAWING`, `*.slddrw`).

Where this approach runs out: the loop and the work are now welded together in one file. Wanting to
run the same export over a different folder, or wanting to do two jobs in one pass, means editing the
macro or copying it. After the third copy you have a maintenance problem.

## Option 2: SOLIDWORKS Task Scheduler

Task Scheduler ships with SOLIDWORKS Professional and Premium, and has a Run Custom Task entry that
runs a macro across a file set.

The catch is real: the macro has to be written against Task Scheduler's own scheduling interface, not
as an ordinary macro operating on the active document. An existing working macro is a rewrite, not a
drop-in. Task Scheduler is also unavailable or heavily reduced on SOLIDWORKS Standard.

For the jobs on its fixed menu - printing drawings, converting drawings to DXF or DWG, upgrading
files to the current version - it is excellent and it is already installed. For running your own
macros it is usually more work than option 1.

The [Task Scheduler alternatives guide](/guides/task-scheduler-alternatives/) covers what it can and
cannot do in detail.

## Option 3: A batch runner that supplies the loop

The third approach separates the two concerns. Your macro stays exactly as it is - a script that
operates on the open document - and a separate application supplies the file list, the open, and the
close.

This is what SwMacroFlow does, and what Batch+ from the Xarial CAD+ Toolset does. Both are free.

With SwMacroFlow the loop lives outside your macro entirely:

- Point it at files, or a folder it walks recursively. Parts, assemblies and drawings are sorted out
  automatically.
- Tick the macros you want, in the order you want them. Each file opens once and every ticked macro
  runs against it in order before the file closes.
- Any macro with an argument-less `Sub main` works unchanged. There is no library to reference and no
  host-specific code to add - see [writing a macro](/docs/writing-a-macro/).
- `MsgBox` does not open a dialog that stops the batch. Each call becomes that file's row in the
  results list, coloured by the icon constant passed to it. That is covered in
  [reporting a result](/docs/reporting-results/).
- Declare a `Const` with an `@Name` token and the app builds an input control for it, so the same
  macro serves different folders and different values without editing. See
  [adding inputs](/docs/adding-inputs/).

The chaining is the part that is hard to replicate in option 1. Setting a custom property, rebuilding
and exporting to PDF is three macros run against one open document, not three passes over the folder
opening every file three times.

If you would rather not write the macro at all, the [macro library](/macros.html) has ready-made ones
for the common jobs - [Save PDF](/macros/save-pdf/), [Save STEP](/macros/save-step/),
[Save Drawing as DXF or DWG](/macros/save-drawing-as-dxf-or-dwg/) and
[Export Properties to CSV](/macros/export-properties-to-csv/) among them. They are plain `.swp` files
under an MIT licence, so they also work as worked examples for option 1.

## Which one to use

| Situation | Use |
|---|---|
| One job, once, on one folder | Write the loop into the macro |
| Job is on Task Scheduler's menu, and you have Pro or Premium | Task Scheduler |
| Same macros, different folders, regularly | A batch runner |
| Several operations per file | A batch runner - chaining is the whole point |
| Hundreds of files, unattended, must survive a crash | A batch runner that restarts SOLIDWORKS |

## Things that bite on large batches

Whichever route you take, a batch of several hundred files behaves differently from a batch of ten.

**SOLIDWORKS leaks memory over a long run.** Not dramatically, but a four-hour batch can end in a
much unhappier session than it started. Restarting SOLIDWORKS every N files is worth building in;
SwMacroFlow does this on a configurable interval.

**One bad file should not end the batch.** Corrupt files, files saved in a newer version, and files
checked out by someone else all fail to open. Handle the failure per file and keep going, and record
which ones failed.

**Read-only and PDM-managed files.** If the folder is a PDM vault view, files not checked out to you
are read-only and any save will fail. Check out first, or work on a copy.

**Dialogs will stop an unattended run.** Anything that opens a modal dialog - including a stray
`MsgBox` you left in for debugging - halts the batch until someone clicks it. This is exactly why
SwMacroFlow reroutes `MsgBox` into the results list rather than letting it open.

## FAQ

### Can I run a SOLIDWORKS macro on a whole folder without writing code?

Yes, with a batch runner. SwMacroFlow and Batch+ are both free and both take an ordinary macro and
supply the folder loop themselves. Task Scheduler can do it too, but only for macros written against
its own interface.

### Do I need to modify my macro to batch it?

With SwMacroFlow or Batch+, generally not - a macro with an argument-less `Sub main` that works on
the active document works as it is. With Task Scheduler's custom task, yes, it needs rewriting
against that interface. Writing the loop yourself obviously means changing the macro.

### Why does my folder loop only process the first file?

Almost always the `Dir` cursor. Something inside the loop called `Dir` again and restarted the
enumeration. Collect all the filenames into an array before opening any document, as in the example
above.

### How do I run a macro on all drawings in a folder?

Change the search pattern to `*.slddrw` and the document type to `swDocDRAWING` in the example above.
In a batch runner, point it at the folder and it sorts document types out for you.

### Can a batch run while I am using SOLIDWORKS for something else?

Not comfortably - the batch is driving the same application, so it will be opening and closing
documents underneath you. Schedule it out of hours instead. SwMacroFlow can create a real Windows
Task Scheduler entry to run a batch overnight.

### What happens if SOLIDWORKS crashes halfway through?

With a hand-written loop, the macro dies with it and you restart by hand. A batch runner that lives
outside the SOLIDWORKS process can detect the crash, restart SOLIDWORKS, and carry on from the next
file. This is the strongest practical argument for an out-of-process tool over an add-in.
