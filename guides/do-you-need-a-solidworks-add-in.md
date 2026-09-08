# Do you need a SOLIDWORKS add-in?

People searching for a SOLIDWORKS add-in usually are not looking for an add-in. They are looking for
a way to make SOLIDWORKS do something repetitive without doing it by hand, and "add-in" is the word
they know for software that extends SOLIDWORKS.

There are three genuinely different ways to extend or automate SOLIDWORKS, and the differences matter
- particularly if what you actually want is to batch process a folder of files. This page explains
what each one is, what it can and cannot do, and how to tell which you need.

## The three shapes

### A macro

A `.swp` file containing VBA. You record or write it, and it runs inside the VBA host that ships with
SOLIDWORKS. No compiler, no installation, no registration - open the VBA editor, paste, run.

A macro operates on whatever document is currently open. It can do very nearly anything the API
exposes, which is very nearly everything you can do by hand. What it cannot do is respond to events
in the background, add buttons to the ribbon that persist between sessions, or run when SOLIDWORKS is
not already open with the right file in front of it.

Macros are the correct answer far more often than people expect. If the task is "do this specific
thing to this document", a macro is the whole job.

### An add-in

A compiled COM library - a `.dll` written in C#, VB.NET or C++ - that implements the `ISwAddin`
interface, is registered with Windows, and is loaded by SOLIDWORKS **inside the SOLIDWORKS process**
when it starts.

An add-in gets things a macro cannot have:

- Toolbar and CommandManager buttons that are there every session
- PropertyManager pages, so your feature looks like a native SOLIDWORKS feature
- Task pane tabs
- Event subscriptions - react when a document opens, a feature changes, a save happens
- Persistent state across the session

The cost is proportionate. It has to be compiled, it has to be registered (which usually wants
administrator rights), it is bound to an architecture and broadly to a version range, and deploying
it to twenty seats is a real IT task rather than emailing a file.

The critical property, for our purposes: an add-in shares a process with SOLIDWORKS. That is what
makes its API calls fast and its UI seamless. It is also what makes it fragile.

### A standalone application

A separate `.exe` that connects to SOLIDWORKS over COM from outside, in its own process. It can
attach to a session that is already running, or start one.

It gets no ribbon buttons and no PropertyManager pages - it is not inside SOLIDWORKS, so it has no
access to SOLIDWORKS' own UI. It has its own window instead.

In exchange it gets four things no add-in can have, and every one of them is about batch work.

## Why batch processing wants a standalone application

**It survives a SOLIDWORKS crash.** This is the big one. On a batch of four hundred files, SOLIDWORKS
will occasionally fall over - a corrupt file, a bad rebuild, memory exhaustion after three hours. An
add-in lives in that process, so when SOLIDWORKS dies the add-in dies with it, mid-batch, with
nothing left running to notice or to recover. A separate process watches its child die, restarts
SOLIDWORKS, and carries on from the next file.

**It can restart SOLIDWORKS deliberately.** SOLIDWORKS accumulates memory over a long unattended run.
Restarting it every N files keeps a four-hour batch healthy. Code running inside the application
cannot restart the application it is running inside.

**It can drive several SOLIDWORKS instances at once.** Two to four sessions sharing one file list,
each taking the next file as it comes free, is straightforward from outside and impossible from
within - an add-in instance only ever sees its own host.

**It can be scheduled.** A Windows Task Scheduler entry launches an executable. There is no way to
tell Windows to start SOLIDWORKS, wait for it, and then poke a button that an add-in installed.

There is a real cost to being out of process: every API call is marshalled across a process boundary,
so a chatty operation is measurably slower than the same code in an add-in. For batch work this
rarely matters, because the wall-clock time is dominated by opening, rebuilding and saving files, not
by the calls that request it.

## Choosing

| You want to | Use |
|---|---|
| Do one repetitive thing to the open document | A macro |
| Give your team a button on the ribbon | An add-in |
| React when a document opens or a feature changes | An add-in |
| Make your tool look like native SOLIDWORKS | An add-in |
| Apply the same operation to a folder of files | A standalone application |
| Run unattended, overnight, or on a schedule | A standalone application |
| Survive crashes across a long batch | A standalone application |
| Use several SOLIDWORKS instances in parallel | A standalone application |

If two rows apply, they are not in conflict - plenty of shops have an add-in for interactive work and
something else for batches.

## Where SwMacroFlow sits

SwMacroFlow is a standalone application, deliberately. It is not a SOLIDWORKS add-in and it does not
register anything inside SOLIDWORKS. It attaches to an installed, licensed x64 SOLIDWORKS session
over COM, or starts one, and drives it from outside.

That choice is exactly the trade above. There is no SwMacroFlow button in your SOLIDWORKS ribbon and
there never will be. In return it restarts SOLIDWORKS when it crashes or on a file-count interval,
runs batches across two to four instances in parallel, and creates real Windows Task Scheduler
entries for unattended overnight runs.

It also means installation is per user with no administrator rights and no elevation prompt, because
there is no COM registration to perform. On a locked-down corporate machine that is often the
difference between using a tool and filing a ticket.

The macros it runs are ordinary macros. Any SOLIDWORKS VBA macro with an argument-less `Sub main`
that operates on the active document works with no changes - see
[writing a macro](/docs/writing-a-macro/). The [macro library](/macros.html) has ready-made ones, and
[what SwMacroFlow does](/docs/overview/) describes the model in full.

## FAQ

### Do I need a SOLIDWORKS add-in to batch process files?

No. Batch processing is better served by a standalone application, because it can restart SOLIDWORKS
after a crash, drive several instances in parallel, and be launched by a scheduler - none of which an
in-process add-in can do. See the
[Task Scheduler alternatives guide](/guides/task-scheduler-alternatives/) for the tools available.

### What is the difference between a SOLIDWORKS macro and an add-in?

A macro is a VBA script in a `.swp` file that runs on the open document, needs no compilation and no
installation. An add-in is a compiled, registered COM library that loads inside the SOLIDWORKS
process and can add ribbon buttons, PropertyManager pages and event handlers. Macros are far quicker
to write; add-ins integrate far more deeply.

### Can a macro do everything an add-in can?

Almost, for anything that acts on the current document. What a macro cannot do is persist UI between
sessions, subscribe to SOLIDWORKS events in the background, or run when nothing is open. Those three
are the reasons to write an add-in.

### Does installing an add-in require administrator rights?

Usually yes, because a COM add-in has to be registered with Windows. This is one of the practical
reasons batch tools are often standalone applications instead - SwMacroFlow installs per user with no
elevation because it registers nothing.

### Is a standalone application slower than an add-in?

Per API call, yes - the calls cross a process boundary. For batch work it rarely shows, because the
time is spent opening, rebuilding and saving files rather than in the calls that ask for it. For
chatty interactive geometry work, an add-in is genuinely faster.

### Can I write an add-in in VBA?

No. Add-ins must be compiled COM libraries, typically C# or VB.NET. VBA is for macros. If you want
the recorded-macro workflow, you want a macro, and then something to run it across your files.
