# Caine

The clever bot for github issue auto-tagging and assignment.

## Instructions

Fetch the OAuth token for the bot:

```sh
./bin/caine --token-for caineio --password secret
```

Create and edit a copy of `example-config.json`:

```sh
cp example-config.json config.json
vim config.json
```

Or create it manually:

```javascript
{
  "token": "...",
  "repo": "indutny/caine#master",
  "contributing": "test/fixtures/CONTRIBUTING.md",
  "labels": {
    "waiting": "need info",
    "success": "caine passed"
  },
  "pollInterval": 60
}
```

Start the caine:

```sh
./bin/caine --config config.json
```

## How it works

Caine will fetch the `config.contributing` file every `config.pollInterval`
seconds and will parse the semantic data out of it.

Then it'll get the list of all un-assigned issues and Pull Requests from the
specified repository (`config.repo`), and will find the ones without
`config.labels.waiting` label, or with a recent comment from the issue author.

Caine will ask user to fill out the form from `config.contributing`, and will
validate it and tag the issue with labels on success.

## Semantic CONTRIBUTING.md

```md
## Caine's section, should just start with `Caine's`

Some text that will be posted on the issue/PR.

Here goes the questions that Caine will expect the answers for.

### Questions:

* _Issue-only_ This kind of question will appear only for issues.
* _PR-only_ This question will appear only for Pull Requests
* Questions may be without expected answer
* Or with expected one. _Expected: `yes`_
* Also, you may ask Caine to expect _One of: `item1, item2, item3`_
* Or add a _label_ for _One of: `a, b, c, d`_

Here could go some text again.

But please don't forget to post like this, to let Caine know how its should
respond to various situations. NOTE: that it is required to put this quotes
in a separate markdown paragraphs.

_In case of success I will say:_ `...summoning the core team devs!`.

_In case of validation problem I will say:_ `Sorry, but something is not right
here:`.

Another thing that you could do with Caine is auto-assignment of issues.

### Responsibilities

It will find the `Responsiblities` section and parse the map out of the first
list in it. When one of the added labels will match the one in this list - 
a random maintainer will be assigned to the issue.

* indutny: crypto, tls, https, child_process, c++
* trevnorris: buffer, http, https, smalloc
* bnoordhuis: http, cluster, child_process, dgram
```

#### LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2014.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
