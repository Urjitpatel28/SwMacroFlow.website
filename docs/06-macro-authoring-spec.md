# Macro authoring spec

The complete contract for a macro that runs under SwMacroFlow, stated in one place.

**Writing a macro with an AI assistant?** Copy this whole section, paste it in, and add what you
want the macro to do. Everything the assistant needs is here - it does not need the rest of this
help page, and it does not need to know anything else about SwMacroFlow.

---

## What the host does

SwMacroFlow is a SOLIDWORKS automation tool that runs a VBA macro (`.swp`) over many documents
unattended. For each file in scope it opens the document, makes it active, calls the macro's
entry-point `Sub`, then closes the document. There is also a *run once* mode in which the chain runs
a single time with no document open.

The macro is not modified. The host runs a throwaway copy in which user-supplied input values have
been substituted and `MsgBox` and `InputBox` have been redefined so they report instead of opening a
dialog. The copy lives under `%TEMP%\SwMacroFlow\` and is deleted when the batch ends.

Several macros may be chained. For each file the host opens once, runs every ticked macro in list
order against that open document, then closes it. Unsaved changes are discarded on close.

## Template

A macro that satisfies every rule below. Start here.

```vb
Option Explicit

' --- Inputs: one Const per field, always As String, token is the whole literal. ---
Const ExportFolder As String = "@ExportFolder"  'Type: FolderPath 'Tooltip: "Where to write the files" 'Value: "C:\Exports"
Const Overwrite    As String = "@Overwrite"     'Type: Bool       'Tooltip: "Replace existing files"    'Value: True
Const MaxRetries   As String = "@MaxRetries"    'Type: Integer    'Tooltip: "Attempts per file"         'Value: 1
Const FileName     As String = "@FileName"      'Type: String     'Tooltip: "Output file name"          'Value: "{PartNumber}.pdf"

Sub main()

    Dim swApp As SldWorks.SldWorks
    Dim model As SldWorks.ModelDoc2
    Dim target As String
    Dim retries As Long
    Dim errors As Long
    Dim warnings As Long

    Set swApp = Application.SldWorks
    Set model = swApp.ActiveDoc

    ' No document: either the file failed to open, or this is the run-once mode.
    If model Is Nothing Then Exit Sub

    ' Inputs arrive as text. Convert, and guard against blank.
    retries = 1
    If Len(MaxRetries) > 0 Then retries = CInt(MaxRetries)

    ' Restrict to the document type this macro makes sense for.
    If model.GetType <> swDocDRAWING Then
        MsgBox "Not a drawing, skipped"
        Exit Sub
    End If

    If Len(Dir(ExportFolder, vbDirectory)) = 0 Then MkDir ExportFolder

    ' FileName may already contain resolved {Property} tokens from the host.
    target = ExportFolder & "\" & FileName

    ' A Bool input is the text "True" or "False".
    If Len(Dir(target)) > 0 And Overwrite <> "True" Then
        MsgBox "Already exists, left alone: " & target
        Exit Sub
    End If

    If model.Extension.SaveAs(target, 0, 0, Nothing, errors, warnings) Then
        MsgBox "Wrote " & target
    Else
        MsgBox "SaveAs failed (error " & errors & ") for " & target, vbCritical
    End If

End Sub
```

## The entry point

The host calls a `Sub` that takes **no arguments**. A `Sub` named `main` is preferred, in any
standard module, case-insensitively. If there is none, the first argument-less `Sub` the VBA project
reports is used, and that order is not under your control.

**Always define `Sub main()`.** A macro with no argument-less `Sub` is rejected at load with *"This
macro has no runnable procedure - it needs a Sub that takes no arguments."*

## The document

The active document is the file the host just opened. Reach it with `Application.SldWorks.ActiveDoc`.
It is never passed as an argument.

`ActiveDoc` is `Nothing` when the document failed to open, and always in the run-once mode. Guard for
it and `Exit Sub`.

The host closes the document after the chain finishes with it, and **closing discards unsaved
changes**. A macro that modifies a document must save it.

The same `Sub` is called again for the next file in the same VBA session, so module-level state
persists between files. Reset it at the top of `main` or do not use it.

In batch mode, do not open or close documents yourself - the host does that. In run-once mode there
is no document; do your own work (folder walk, report, application options) without relying on
`ActiveDoc`.

## Inputs

### Grammar

```
Const <Name> As String = "@<Token>"   '<Key>: <value>   '<Key>: <value>
```

- `Const` begins the line, optionally indented. Declarations are recognised in **any standard
  module**.
- `As String` is **required on every input**, whatever the declared `Type:`.
- `<Token>` is letters, digits and underscores. The `"@<Token>"` literal must be the **entire**
  string - nothing else inside the quotes.
- The metadata is an ordinary VBA comment tail. Each `'<Key>:` segment runs until the next `'` that
  introduces a recognised key, so an apostrophe inside a tooltip is safe.
- Quotes around a metadata value are optional.
- **One line per declaration is preferred**, aligned as in the template above - but a declaration
  may be continued with a trailing `_`, and so may its metadata tail. Give every key its own `'`,
  including on a continued line, or the key is read as part of the previous one:

  ```vb
  Const WidthPx As String = "@WidthPx" _
      'Type: Integer 'Tooltip: "Thumbnail width in pixels" _
      'Value: 256
  ```

  A declaration *preceded* by a comment line ending in `_` is swallowed by that comment, exactly as
  VBA sees it, and creates no input.

The host replaces every occurrence of `@<Token>` in the source with the user's value before running
(except when that value carries `{Property}` placeholders - see below). The user sees a field
labelled `<Token>` (the `@` is dropped). The Const identifier `<Name>` is what your VBA code reads;
the field label comes from the token.

### Metadata keys

All optional, all case-insensitive. Unknown keys are ignored.

| Key | Applies to | Meaning |
|---|---|---|
| `Type:` | all | Which control to build. `String` if omitted. |
| `Tooltip:` | all | Hover text. |
| `Value:` | all | The **default** the form starts with. Never a filter or a constraint. |
| `Filter:` | `FilePath` | Extensions the picker narrows to, comma-separated, e.g. `".sldprt, .sldasm"`. |
| `Options:` | `Option` | The dropdown's choices, comma-separated. |

### Types

| `Type:` | Synonyms | Control | Value your code receives |
|---|---|---|---|
| `String` | anything unrecognised | Text box | the text typed |
| `Integer` | `Int` | Whole-number text box | the digits **as text** - use `CInt()` |
| `Bool` | `Boolean` | Checkbox | the text `"True"` or `"False"` |
| `FilePath` | | Text box plus file picker | the full path |
| `FolderPath` | | Text box plus folder picker | the full path |
| `Option` | `Dropdown` | Dropdown | the chosen item's **text**, never an index |

An `Option` whose `Value:` is not one of its own `Options:` raises a warning and the first option is
selected.

### Input rules

- Every input value is a **string**, whatever its `Type:`. That is why `As String` is mandatory:
  `Const Q As Integer = "@Quantity"` is a VBA type mismatch and fails the load check.
- Blank is always allowed and substitutes an empty string. Guard before converting.
- Only a `Const` declaration creates a field. A token used elsewhere is still substituted but adds
  no control; an undeclared token raises a warning.
- A token inside a `'` or `Rem` comment is ignored.
- The same token declared twice is one field that fills in both declarations.
- `"bob@example.com"` and `"C:\out\@name.txt"` are left alone - the token must be the whole literal.
- Inputs are per macro row. Two macros that both declare `@Name` each get their own value.

### Validation before Run

Blank is always legal. Run is blocked (and the reason names the macro) when:

| Condition | Message shape |
|---|---|
| Non-blank `Integer` that will not parse | *Enter a valid whole number for every number input in …* |
| Malformed `{Property}` braces in a `String`, `FilePath`, or `FolderPath` value | *Fix every property placeholder in …* |
| Non-blank `FilePath` that does not exist (and has no `{Property}` tokens) | *Choose a file that exists for every file input in …* |

`FolderPath` is **not** existence-checked - macros commonly create the folder themselves. A
`FilePath` whose value contains well-formed `{Property}` tokens also skips the existence check,
because the path is not meant to exist until each document resolves it.

## Property placeholders in input values

A `String`, `FilePath`, or `FolderPath` value the user types may mix literal text with
`{PropertyName}` tokens - for example `{PartNumber}_{Revision}.pdf`. Braces are reserved for that
syntax in those three types; there is no escape in v1. Tokens are highlighted magenta in the Inputs
panel as you type.

`{Title}` is reserved: it always resolves to the open document's filename with its extension
stripped (`Part1.SLDPRT` -> `Part1`), never a custom property - even one literally named `Title`.
Every other `{Name}` looks up a custom property as described below.

Unlike an `"@Name"` token (baked into the temp copy before the batch starts), each `{Property}` is
resolved **per document while the macro runs**, against the open document only:

1. Active configuration's properties first
2. Then file-level custom properties

Lookup is case-insensitive and uses the **resolved** value, so expressions like `SW-Mass` become the
evaluated number rather than the expression text.

| Outcome | Result |
|---|---|
| Property found | Token replaced with the resolved value |
| Property missing from both stores | That file **fails** with a named error; the batch continues. Does **not** expand to empty. |
| No document open (run-once, or open failed) | That run **fails** - cannot resolve against a document |
| Malformed braces (`a{b`, `{ }`, nested) | Run is blocked before the batch starts |

Integer, Bool, and Option inputs stay literal - they never resolve property tokens.

Your macro code does not expand `{Property}` itself. When the user enters
`{PartNumber}.pdf` into a String input, the host resolves it before (or as) your `Const` receives the
value for that file. Treat the Const as ordinary text that already holds the final string.

Do not use `{Property}` inputs in a macro that only runs in run-once mode with no document - there
is nothing to resolve against.

## Reporting

`MsgBox` is redefined in the copy the host runs. Each call writes one line to that file's result
instead of opening a dialog. The row shows the most severe line; the log keeps them all.

| Call | Row | Returns |
|---|---|---|
| `MsgBox "text"` | Green - status | `vbOK` |
| `MsgBox "text", vbCritical` | **Red - the file failed** | `vbOK` |
| `MsgBox "text", vbExclamation` / `vbInformation` / `vbQuestion` | Green - status | `vbOK` |
| `MsgBox "text", vbYesNo` | Amber - prompt auto-answered | `vbNo` |
| `MsgBox "text", vbOKCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbYesNoCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbRetryCancel` | Amber | `vbCancel` |
| `MsgBox "text", vbAbortRetryIgnore` | Amber | `vbAbort` |
| `InputBox("text", , "42")` | Amber | `"42"` - the `Default` argument |
| An unhandled VBA runtime error | Red, as `Error <n>: <description>` | - |
| Missing `{Property}` / no document to resolve | Red, named error from the host | - |
| No call at all | Green | - |

Severity order is red, then amber, then green. Within one severity the first message wins, and the
row's status and text always come from the same call.

Write messages that identify the file or the value that varies - a row is read alongside hundreds of
others.

If the macro needs a yes/no or a path, make it an **input** instead of a `MsgBox` / `InputBox`
prompt. Amber means the batch guessed.

## Must

- Define `Sub main()` with no arguments.
- Set `Option Explicit` and declare every variable.
- Guard `If model Is Nothing Then Exit Sub` before touching the document.
- Declare every input as `Const <Name> As String = "@<Token>"`.
- Convert `Integer` inputs with `CInt()`, and compare `Bool` inputs against the text `"True"`.
- Check the document type with `model.GetType` if the macro only suits one kind.
- Save any document you change.
- Report failure with `MsgBox "...", vbCritical` and return from the `Sub`.

## Must not

- **Do not call `VBA.MsgBox`.** The `VBA.` prefix binds to the type library and cannot be
  intercepted - it opens a real modal dialog and the batch hangs until someone clicks it. Use a bare
  `MsgBox`.
- **Do not show a UserForm.** A form's dialog cannot be intercepted either, and hangs the batch the
  same way.
- Do not declare an input as anything but `As String`.
- Do not use `GetCurrentMacroPathName` to locate files near your macro - the running copy is in
  `%TEMP%\SwMacroFlow\` and that is the path you get back. Use a `FilePath` or `FolderPath` input
  instead.
- Do not open or close documents yourself in batch mode; the host does it.
- Do not rely on `ActiveDoc` in the run-once mode - there is none.
- Do not depend on module-level state surviving cleanly from one file to the next.
- Do not use `End` or `Stop` - `End` tears down the VBA project mid-batch.
- Do not expect `{Property}` tokens to work without an open document.

## Symptom to cause

| What you see | Cause |
|---|---|
| *"Macro has a compile error"* when adding it | Usually an input declared as something other than `As String`. |
| *"This macro has no runnable procedure"* | No argument-less `Sub`. Add `Sub main()`. |
| *"Can't read this macro's VBA project"* | SOLIDWORKS VBA editor: Tools → Options → Security → Trust Center → Macro Settings → tick *Trust access to the VBA project object model*. |
| *"Fix every property placeholder in …"* | A `String` / `FilePath` / `FolderPath` value has malformed braces. |
| *"Choose a file that exists …"* | A `FilePath` without `{Property}` tokens points at a missing file. |
| The batch hangs on the first file | A `VBA.MsgBox` call or a UserForm somewhere in the project. |
| Every row is amber | A `MsgBox` with a button set other than the default, or an `InputBox`, is being reached on every file. |
| An input has no field on the form | The token was used but never declared as a `Const`, or the literal is not exactly `"@Token"`. A declaration on the line after a comment ending in `_` is part of that comment. |
| An input is a plain text box with no tooltip or default, though the metadata is there | On a continued declaration, a key lost the `'` in front of it and was read as part of the previous key. |
| A wrong procedure runs | The entry point is not named `main`. |
| `Error 91` on every file | `ActiveDoc` was used without the `Is Nothing` guard. |
| Red row naming a missing property | A `{Property}` token was not found on that document. |
| Red row about cannot resolve / no document | `{Property}` used in run-once mode, or the document failed to open. |
| Changes are not saved | The macro modified the document but never saved it; closing discarded the edit. |
| The macro cannot find a file beside itself | `GetCurrentMacroPathName` returns the temporary copy's path. Use a `FilePath` or `FolderPath` input instead. |
