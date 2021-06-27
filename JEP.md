---
title: Jupyter integration with the Language Server Protocol
authors: Nicholas Bollweg (@bollwyvl), Jeremy Tuloup (@jtpio), Michał Krassowski (@krassowski)
issue-number: 67
pr-number: <proposal-pull-request-number>
date-started: 2021-06-27
---

# Summary

[jupyter(lab)-lsp](https://github.com/krassowski/jupyterlab-lsp) is a project bringing integration
of language-specific IDE features (such as diagnostics, linting, autocompletion, refactoring) to the
Jupyter ecosystem by leveraging the established
[Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP), with a good
overview on the [community knowledge site](https://langserver.org). We would like to propose its
incorporation as an official sub-project of Project Jupyter. We feel this would benefit Jupyter
users through better discoverability of advanced interactive computing features, supported by the
(LSP), but otherwise missing in a user's Jupyter experience. While our repository currently features
a working implementation, the proposal is not tied to it (beyond a proposal for migration of the
repository to a Jupyter-managed GitHub organization) but rather aimed to guide the process of
formalizing and evolving the way of integrating Jupyter with LSP in general.

# Motivation

A common criticism of the Jupyter environment (regardless of the front-end editor) and of the
official Jupyter frontends (in light of recent, experimental support of feature-rich notebook
edition under development by some of the major IDE developers) is the lack of advanced code
assistance tooling. The proper tooling can improve code quality, validity of computation and
increase development speed and we therefore believe that it is a key ingredient of a good
computational notebooks environment, which from the beginning aimed at improving the workflow of
users.

Providing support for advanced coding assistance for each language separately is a daunting task,
challenging not only for volunteer-driven projects, but also for large companies. Microsoft
recognized the problem creating the Language Server Protocol with reference implementation in
VSCode(TM).

Many language servers are community supported and available for free (see the community-maintained
list of [language servers](https://langserver.org/)).

# Guide-level explanation

Much like
[Jupyter Kernel Messaging](https://jupyter-client.readthedocs.io/en/stable/messaging.html), LSP
provides a language-agnostic, JSON-compatible description for multiple clients to integrate with any
number of language implementations. Unlike Kernel Messaging, the focus is on precise definition of
the many facets of static analysis and code transformation, with nearly four times the number of
messages of the Jupyter specification. We will discuss the opportunities and challenges of this
complexity for users and maintainers of Jupyter Clients, Kernels, and related tools.

The key component of the repository,
[@krassowski/jupyterlab-lsp](https://www.npmjs.com/package/@krassowski/jupyterlab-lsp), offers
Jupyter users an expanded subset of features described by the LSP as an extension to JupyterLab.
These features include refinements of existing Jupyter interactive computing features, such as
completion and introspection, as well as new Jupyter features such as linting, reference linking,
and symbol renaming. It is supported by [jupyter-lsp](https://pypi.org/project/jupyter-lsp/), a
Language Server- and Jupyter Client-agnostic extension of the Jupyter Notebook Server (for the `0.x`
line) and Jupyter Server (for the `1.x`). We will discuss the architecture and engineering process
of maintaining these components at greater length, leveraging a good deal of the user and developer
[documentation](https://jupyterlab-lsp.readthedocs.io/en/latest/?badge=latest).

# Reference-level explanation

The current implementation of the LSP integration is a barely a proof of concept. We believe that a
different implementation should be developed to take the more comprehensive use cases and diversity
of the Jupyter ecosystem into account; we created detailed proposals for improvement and refactoring
of our code as explained later.

## Dealing with Jupyter notebooks complexity

The following features need to be considered in the design:

The interactive, data-driven computing paradigm provides additional convenience features on top of
existing languages:

- cell and line magics
- tranclusions: "foreign" code in the document, often implemented as magics which uses a different
  language or scope than the rest of the document (e.g. `%%html` magic in IPython)
- polyglot notebooks using cell metadata to define language
- the concept of cells, including cell outputs and cell metadata (e.g. enabling LSP extensions to
  warn users about unused empty cells, out of order execution markers, etc., as briefly discussed in
  [#467](https://github.com/krassowski/jupyterlab-lsp/issues/467))

## Current implementation

Currently:

- the notebook cells are concatenated into a single temporary ("virtual") document on the frontend,
  which is then sent to the backend,
  - the navigation between coordinate system is performed by the frontend and is based solely on the
    total number of lines after concatenation
- as a workaround for some language servers requiring actual presence of the file on the filesystem
  (against the LSP spec, but common in some less advanced servers), our backend Jupyter server
  extension creates a temporary file on the file system (by default in the `.virtual_documents`
  directory); this is scheduled for deprecation,
- Jupyter server extension serves as:
  - a transparent proxy between LSP language servers and frontend, speaking over websocket
    connection
  - a manager of language servers, determining whether specific LSP servers are installed and
    starting their processes
    - JSON files or declarative Python classes registered via entry points are used to define
      specification of the LSP servers (where to look for an executable of the LSP server, for which
      languages/kernels given LSP server should be used, what is its display name, etc.)

# Rationale and alternatives

A previous (stale) JEP proposed to integrate LSP and to adopt Monaco editor, which would entail
bringing a heavy dependency and large reliance on continuous development of Monaco by Microsoft; it
was not clear whether Monaco would allow efficient use in multi-editor notebook setting and the work
on the integration stalled a few years ago. Differently to that previous proposal we **do not**
propose to adopt any specific implementation, yet we bring a working implementation for CodeMirror 5
editor, which is already in use by two of the official front-ends for Jupyter (Jupyter Notebook and
JupyterLab). While the nearly-feature-complete CodeMirror 6 has specifically declared LSP
integration to be a non-goal, it does however provide a number of features which would allow for
cleaner integration of multiple sources of editor annotation, such as named bundles of marks.

The Jupyter originally driving innovation in the field is now in some communities perceived as a
driver behind bad coding practices due to the lack of available toolset in the official frontends.
Alternative formats to ipynb were proposed and sometimes the only motivation was a better
IDE-features support.

# Prior art

Multiple editors already support the Language Server Protocol, whether directly or via extension
points, including VSCode, Atom, Brackets (Adobe), Spyder, Visual Studio and many more. The list of
clients and their capabilities is described at the community-maintained
[knowledge site](https://langserver.org/) in the "LSP clients" section and at official website of
the [LSP protocol](https://microsoft.github.io/language-server-protocol/implementors/tools/).

Multiple proprietary notebook interfaces attempted integration of language features such as those
provided by LSP, including Google Colab, Datalore, Deepnote, and Polynote; due to proprietary
implementation details it is not clear how many of the existing solutions employ LSP (or its subset)
under the hood.

The on-going integration of the [Debug Adapter Protocol][dap] has demonstrated both the user
benefits, and kernel maintainer costs, of "embracing and extending" existing, non-Jupyter protocols
rather than re-implementing.

# Unresolved questions

The current implementation can be improved by:

1. embedding cell identifiers (and possibly metadata) as comments in the virtual document at a place
   corresponding to the start of each cell (in jupytext-compatible way), to enable easier
   calculation of positions and implementation of refactoring features (e.g. linting with black)
   that add or remove lines (which is not currently possible),
   - adding metadata might be required to enable polyglot SOS notebooks, see discussion in
     [#282](https://github.com/krassowski/jupyterlab-lsp/issues/282)
   - one might consider if it is worth to delegate this task to jupytext; this would necessitate
     moving the notebook concatenation logic to the server extension, with a positive side effect of
     exposing it for re-use by other clients, but with a potential downsides of the need to
     frequently transfer the entire notebook (on each debounced keypress) to the server extension
     (which could be alleviated if implemented via delta/diffs; this adds more logic but given that
     notebooks is just a JSON it might be feasible to use an existing tool) and with a downside of
     having the notebook-virtual document position transformation code on both backend and frontend
     as the frontend part cannot be easily (or at al?) eliminated; as this option looks promising it
     will be investigated once current performance shortcomings are resolved.
   - see further discussion in [#467](https://github.com/krassowski/jupyterlab-lsp/issues/467)
2. formalizing grammar of substituting magics with equivalent or placeholder (which allows for
   one-to-one mapping of magics to code that can be understood by standard refactoring tools and
   back to the magics after the code was transformed by the refactoring tools, for example moved to
   another file), see [#347](https://github.com/krassowski/jupyterlab-lsp/issues/347)
3. abstracting the communication layer between client and server so that different mechanisms can be
   used for such communication, for example:
   - custom, manually managed websocket between the client and jupyter server extension (existing
     solution),
   - websocket managed reusing the kernel comms (acting as a transparent proxy but reducing the
     number of dependencies since in the context of Jupyter the kernel comms are expected to be
     present either way), see the proposed implementation in
     [#278](https://github.com/krassowski/jupyterlab-lsp/pull/278)
   - direct connection to a cloud or self-hosted service providing language intelligence as a
     service, e.g. [sourcegraph](https://about.sourcegraph.com/)
   - (potentially) in-client language servers, such a JSON Schema-aware language server to assist in
     configuration

There are also smaller fires to put out in the current implementation which we believe do not
warrant further discussion; however, we want to enumerate those to assure a potentially concerned
reader that those topics are being looked at and considered a priority due to the immediate impact
on user and/or developer experience:

- reorganizing deeply nested code into shallower structure of multiple packages, one per each
  feature (with the current state of the repository in half a monorepo, half complex project being
  an annoyance to maintainers and contributors alike)
- improving performance of completer and overall robustness of the features
- enabling integration with other packages providing completion suggestions
- enabling use of multiple LSP servers for a single document

# Future possibilities

- Amending the kernel messaging protocol to ask only for runtime (e.g. keys in a dictionary, columns
  in a data frame) and kernel-specific completions (e.g. magics), this is excluding static-analysis
  based completions, to improve the performance of the completer
- Seeding existing linting tools with plugins to support notebook-specific features (empty cells,
  out of order execution, largely as envisioned by pioneering work of
  [JuLynter](https://dew-uff.github.io/julynter/index.html) experiment)
  - also see [lintotype]
- Encouraging contributions to existing language-servers and offering platform for development of
  Jupyter-optimized language servers
- Enabling LSP features in markdown cells
- Implementing support for related Language Server Index Format (LSIF), a protocol closely related
  to LSP and defined on the
  [specification page](https://microsoft.github.io/language-server-protocol/specifications/lsif/0.5.0/specification/)
  for even faster IDE features for the retrieval of immutable (or infrequently mutable) information,
  such as documentation of built-in functions.

[lintotype]: https://github.com/deathbeds/lintotype/
[dap]:
  https://github.com/jupyter/enhancement-proposals/blob/master/jupyter-debugger-protocol/jupyter-debugger-protocol.md
