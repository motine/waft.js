# waft.js

Waft.js is a very minimal framework for sprinkling minimal dynamic behavior over html elements via JavaScript.

The motivation was to:

- express simple, one-off frontend behavior as concise as possible
- make it so simple, one can understand all concepts instantly
- avoid serialization between the rendered page content and the dynamic code
- avoid setup of a javascript build chain
- syntax works well with Rails and HAML

```html
<script src="https://cdn.jsdelivr.net/gh/motine/waft.js/waft.min.js" defer></script>

<span w-ref="time" w-text="return +new Date()"></span>
<span w-ref="warning" w-show="return new Date().getHours() > 18">Wow, it's late!</span>
<span w-on:click="wUpdate($time)">click me</span>
```

**Please use the minified version in your app, because it is transpiled and has better browser support.**

See more examples below or live demos in this [codepen](https://codepen.io/motine/pen/RwgrdOx).

## Concepts

Waft.js defines **event handlers** like so:

```html
<span w-on:click="alert('hello')">
```

Available events are: `blur`, `click`, `change`, `keyup`, `keydown`, `submit`.
Please mind that the submit event is bound to the surrounding form, but the handler is only executed if this particular element is used for submitting <!-- (useful for dynamicSubmit) -->.

In order to reference other elements, we can define and use **references** like so:

```html
<input w-ref="some">
<div w-on:click="$some.value = '77'">click me</div>
```

You have access to all refs inside of event handlers and directives, but you can also use `waftJs.refs.$myref` in an "outside" function.


To change an element, Waft.js defines **directives**:

```html
<div w-show="return new Date().getHours() > 18">It's late!</div>
<!-- make sure to use return in directives -->
```

Available directives are (see examples below):
- `w-show`: shows/hides the element
- `w-value`: sets the value of the (input) element
- `w-text`: sets the textContent
- `w-html`: sets the innerHTML
- `w-class`: sets the className
- `w-update`: is triggered if the element is supposed to be updated

In each event handler and directive you have the following **context** setup for you when the code runs:

- `this`: bound to the element with the directive
- `$...`: all refs are available
- `$ev`: the original browser event (only set in case of an event handler)
- `wUpdate`: see below

Waft.js does not support reactive properties (e.g. like [alpinejs](https://alpinejs.dev/) does), because in our domain we often need reactive `input` values. Making such builtin values reactive is not easily possible and requires additional variables (most frameworks use "bind"). Adding such a variable seemed overkill for our context.

Hence, Waft.js uses the `wUpdate(element, ...)` method which triggers an **update** for the given elements. Example:

```html
<input w-ref="inp" w-on:change="wUpdate($dep)">
<div w-ref="dep" w-show="$inp.value == 77">It's 77</div>
```

## More examples

In the following, we use [HAML](https://haml.info/) for examples.
Please see the live demos in this [codepen](https://codepen.io/motine/pen/RwgrdOx).


**set the text of the element on page load**
```haml
%span{ 'w-text': 'return new Date()' }
```

**force update**
```haml
%span{ 'w-ref': 'time', 'w-text': 'return +new Date()' }
%span{ 'w-on:click': 'wUpdate($time)' } click me
```

**toggle element visibility**
```haml
%span{ 'w-ref': 'depElm', 'w-show': 'return this.style.display == "none"' } will be toggled each time wUpdate is called (and once on page load)
%span{ 'w-on:click': 'wUpdate($depElm)' } click me
```

**change visibility of an element when another changes**
```haml
%input{ 'w-ref': 'visOther', 'w-on:keyup': 'wUpdate($vis)', placeholder: 'change the value' }
%span{ 'w-ref': 'vis', 'w-show': 'return !!$visOther.value' } field is filled
```

**synchronize input of two elements**
```haml
%input{ 'w-ref': 'someElm', 'w-on:keyup': 'wUpdate($depElm)' }
%input{ 'w-ref': 'depElm', 'w-value': 'return $someElm.value' }
```

**update multiple elements**
```haml
%input{ 'w-ref': 'orig', 'w-on:change': 'wUpdate($field1, $field2)' }
%span{ 'w-ref': 'field1', 'w-show': 'return $mult.value == "77"' } shown only if 77
%span{ 'w-ref': 'field2', 'w-text': 'return $orig.value' }
```

**run arbitrary code when update is required (color picker)**
```haml
%input{ 'w-ref': 'color', 'w-on:keyup': 'wUpdate($preview)', value: '#ffcc00' }
%span{ 'w-ref': 'preview', 'w-update': 'this.style.backgroundColor = $color.value' } Hello
```

**alert if return is pressed (access the event)**
```haml
%input{ 'w-on:keyup': 'if ($ev.keyCode == 13) { alert("return pressed"); }' }
```

**add form data before submit**

_for brevity we use jQuery._

```haml
%form
  %input{ type:"submit", 'w-on:submit': "$(this.form).append('<input name=\"a\" value=\"77\" />')", value: "Submit additional data" }
  %input{ type:"submit", value: "Submit" }
```

**use with simpleform (hide the full input-group if certain value is given)**
```haml
= f.input :myval, input_html: { 'w-ref': 'myval', 'w-on:change': 'wUpdate($other)' }
= f.input :other, wrapper_html: { 'w-ref': 'other', 'w-show': 'return $myval.value != "wurst"' }
```

**call arbitrary function / add row to a nested form**

_for brevity we use jQuery._

```haml
:javascript
  function addRow(container) {
    $(container).append(`<input name="form[nested][${+new Date()}]">`);
  }
%div{ 'w-ref': 'container'}
.btn{ 'w-on:click': 'addRow($container)' } add row
```

<!--
## Comparison

In this comparison we implement a very simple preview for a color picker.
This example is super simple. The listed technologies below are obviously not as concise as waft.js because they are made to scale and to make code reusable. waft.js does not have those goals, so we end up with less code.

```html
<input w-ref="color" w-on:keyup="wUpdate($preview)" value="#ffcc00">
<span w-ref="preview" w-update="this.style.backgroundColor = $color.value">Hello<span>
```


Stimulus: good alternative, but you have to add a new controller for each use case

Vue / React

alpine.js
-->
## Development

```bash
# build the minified version
docker run -it --rm -v $PWD:/app -w /app node /bin/bash -c 'npm install && npm run build'
```
