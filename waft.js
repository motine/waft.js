// Waft.js is a very minimal framework for sprinkling minimal dynamic behavior over html elements via javascript.
//
// see demos here: https://codepen.io/motine/pen/RwgrdOx
//
// Waft.js defines event handlers like so:
//   <span w-on:click="alert('hello')">
// Available events are: blur, click, change, keyup, keydown, submit
// Please mind that the submit event is bound to the surrounding form, but the handler is only executed if this particular element is used for submitting (useful for dynamicSubmit).
//
// In order to reference other elements, we can define and use references like so:
//   <input w-ref="some">
//   <div w-on:click="$some.value = '77'">click me</div>
// You have access to all refs inside of event handlers and directives, but you can alos use waftJs.ref.$myref in an "outside" function.
//
// To change an element, Waft.js defines directives:
//   <div w-show="return new Date().getHours() > 18">It's late!</div> <!-- make sure to use return in directives -->
// Available directives are (see examples below):
// - w-show: shows/hides the element
// - w-value: sets the value of the (input) element
// - w-text: sets the textContent
// - w-html: sets the innerHTML
// - w-update: is triggered if the element is supposed to be updated
//
// In each event handler and directive you have the following context setup for you when the code runs:
// - this: bound to the element with the directive
// - $...: all refs are available
// - $ev: the original browser event (only set in case of an event handler)
// - wUpdate: see below
//
// Waft.js does not support reactive properties (e.g. like alpinejs does), because in our domain we often need reactive input values.
// This is not easily possible, so most frameworks "bind" a reactive variable to the input's value. This solution seemed clunky for our domain.
// Hence, Waft.js uses the wUpdate(element, ...) method which triggers an update for the given elements. Example:
//  <input w-ref="inp" w-on:change="wUpdate($dep)">
//  <div w-ref="dep" w-show="$inp.value == 77">It's 77</div>
//
// Examples:
//   // set the text of the element on page load
//   %span{ 'w-text': 'return new Date()' }
//
//   // force update
//   %span{ 'w-ref': 'time', 'w-text': 'return +new Date()' }
//   %span{ 'w-on:click': 'wUpdate($time)' } click me
//
//   // toggle element visibility
//   %span{ 'w-ref': 'depElm', 'w-show': 'return this.style.display == "none"' } will be toggled each time wUpdate is called (and once on page load)
//   %span{ 'w-on:click': 'wUpdate($depElm)' } click me
//
//   // change visibility of an element when another changes
//   %input{ 'w-ref': 'visOther', 'w-on:keyup': 'wUpdate($vis)', placeholder: 'change the value' }
//   %span{ 'w-ref': 'vis', 'w-show': 'return !!$visOther.value' } field is filled
//
//   // synchronize input of two elements
//   %input{ 'w-ref': 'someElm', 'w-on:keyup': 'wUpdate($depElm)' }
//   %input{ 'w-ref': 'depElm', 'w-value': 'return $someElm.value' }
//
//   // update multiple elements
//   %input{ 'w-ref': 'orig', 'w-on:change': 'wUpdate($field1, $field2)' }
//   %span{ 'w-ref': 'field1', 'w-show': 'return $mult.value == "77"' } shown only if 77
//   %span{ 'w-ref': 'field2', 'w-text': 'return $orig.value' }
//
//   // run arbitrary code when update is required (color picker)
//   %input{ 'w-ref': 'color', 'w-on:keyup': 'wUpdate($field1)', value: '#ffcc00' }
//   %span{ 'w-ref': 'field1', 'w-update': 'this.style.backgroundColor = $color.value' } Hello
//
//   // alert if return is pressed (access the event)
//   %input{ 'w-on:keyup': 'if ($ev.keyCode == 13) { alert("return pressed"); }' }
//
//   // use with simpleform (hide the full input-group if certain value is given)
//   = f.input :myval, input_html: { 'w-ref': 'myval', 'w-on:change': 'wUpdate($other)' }
//   = f.input :other, wrapper_html: { 'w-ref': 'other', 'w-show': 'return $myval.value != "wurst"' }
//
//   // call arbitrary function / add row to a nested form (using jQuery)
//   :javascript
//     function addRow(container) {
//       $(container).append(`<input name="form[nested][${+new Date()}]">`);
//     }
//   %div{ 'w-ref': 'container'}
//   .btn{ 'w-on:click': 'addRow($container)' } add row
class WaftJs {
  AVAILABLE_EVENT_NAMES = ['blur', 'click', 'change', 'keyup', 'keydown', 'submit'];
  AVAILABLE_DIRECTIVES = {
    'w-show': (elm, evaluationResult) => {
      if (evaluationResult) {
        if (elm.mOriginalDisplay) {
          elm.style.display = elm.mOriginalDisplay
        } else {
          elm.style.removeProperty('display')
        }
      } else {
        if (elm.style.display != 'none') {
          elm.mOriginalDisplay = elm.style.display;
        }
        elm.style.display = 'none';
      }
    },
    'w-value': (elm, evaluationResult) => {
      elm.value = evaluationResult;
    },
    'w-update': (elm, evaluationResult) => { },
    'w-text': (elm, evaluationResult) => {
      elm.textContent = evaluationResult;
    },
    'w-html': (elm, evaluationResult) => {
      elm.innerHTML = evaluationResult;
    }
  }

  // enable the Waft.js magic for the given element/document and all its children
  register(scopeElm) {
    const eventSelectors = this.AVAILABLE_EVENT_NAMES.map( key => `[w-on\\:${key}]` );
    const directiveSelectors = Object.keys(this.AVAILABLE_DIRECTIVES).map( key => `[${key}]` );

    let elements = scopeElm.querySelectorAll([...eventSelectors, directiveSelectors].join(', '));
    if (scopeElm != document) { elements = [scopeElm, ...elements]; } // make sure to attach to the element itself too (important for the mutation observer)

    for (const elm of elements) {
      this.registerEventHandler(elm);
      this.updateElement(elm);
    }
  }

  get refs() {
    return this.collectRefs();
  }

  // the following methods are to be considered private

  registerEventHandler(elm) {
    for (const eventName of this.AVAILABLE_EVENT_NAMES) {
      const attributeName = `w-on:${eventName}`;
      const attribute = elm.attributes[attributeName];
      if (!attribute) { continue; }
      const code = attribute.value;
      if (eventName == 'submit') {
        elm.form.addEventListener('submit', (ev) => { if (ev.submitter == elm) { this.handleEvent('submit', elm, code, ev) }});
      } else {
        elm.addEventListener(eventName, (ev) => { this.handleEvent(eventName, elm, code, ev) });
      }
    }
  }

  handleEvent(eventName, targetElm, code, originalEvent) {
    this.evaluateString(code, targetElm, originalEvent)
  }

  evaluateString(code, contextThis, originalEvent = undefined) {
    try {
      const fun = Function('context', `with (context) { ${code} }`);
      const context = {
        wUpdate: (...targetElms) => { this.updateElements(targetElms); },
        ...this.collectRefs(),
        $ev: originalEvent
      };
      return fun.call(contextThis, context)
    } catch (error) {
      console.error("error when running this code:\n", code)
      throw error
    }
  }

  // returns an object of the form { $myref: 'myvalue', ... }
  collectRefs() {
    let result = {};
    for (const elm of document.querySelectorAll('*[w-ref]')) {
      const refName = elm.attributes['w-ref'].value;
      result[`$${refName}`] = elm;
    }
    return result;
  }

  updateElements(targetElms) {
    for (const targetElm of targetElms) {
      this.updateElement(targetElm);
    }
  }

  updateElement(targetElm) {
    for (const [directiveName, directiveHandler] of Object.entries(this.AVAILABLE_DIRECTIVES)) {
      const directiveAttributeOnTarget = targetElm.attributes[directiveName];
      if (directiveAttributeOnTarget) {
        const evaluationResult = this.evaluateString(directiveAttributeOnTarget.value, targetElm);
        directiveHandler(targetElm, evaluationResult);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.waftJs = new WaftJs(document);
  window.waftJs.register(document);

  observer = new MutationObserver((mutationsList, _observer) => {
    for (const mutation of mutationsList) {
      for (const addedNode of mutation.addedNodes) {
        if (addedNode.nodeType == 1) { // 1: ELEMENT_NODE
          window.waftJs.register(addedNode);
        }
      }
    }
  });
  observer.observe(document, { attributes: false, childList: true, subtree: true });
});
