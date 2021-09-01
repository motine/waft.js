// waft.js
// version: 0.1
// author: Tom Rothe
// licence: MIT
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
