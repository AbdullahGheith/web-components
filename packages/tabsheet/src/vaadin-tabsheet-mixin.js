/**
 * @license
 * Copyright (c) 2022 - 2024 Vaadin Ltd.
 * This program is available under Apache License Version 2.0, available at https://vaadin.com/license/
 */
import { DelegateStateMixin } from '@vaadin/component-base/src/delegate-state-mixin.js';
import { OverflowController } from '@vaadin/component-base/src/overflow-controller.js';
import { SlotController } from '@vaadin/component-base/src/slot-controller.js';
import { SlotObserver } from '@vaadin/component-base/src/slot-observer.js';
import { generateUniqueId } from '@vaadin/component-base/src/unique-id-utils.js';

/**
 * @private
 * A controller which observes the <vaadin-tabs> slotted to the tabs slot.
 */
class TabsSlotController extends SlotController {
  constructor(host) {
    super(host, 'tabs');
    this.__tabsItemsChangedListener = this.__tabsItemsChangedListener.bind(this);
    this.__tabsSelectedChangedListener = this.__tabsSelectedChangedListener.bind(this);
  }

  /** @private */
  __tabsItemsChangedListener() {
    this.host._setItems(this.tabs.items);
  }

  /** @private */
  __tabsSelectedChangedListener() {
    this.host.selected = this.tabs.selected;
  }

  initCustomNode(tabs) {
    if (!(tabs instanceof customElements.get('vaadin-tabs'))) {
      throw Error('The "tabs" slot of a <vaadin-tabsheet> must only contain a <vaadin-tabs> element!');
    }
    this.tabs = tabs;
    tabs.addEventListener('items-changed', this.__tabsItemsChangedListener);
    tabs.addEventListener('selected-changed', this.__tabsSelectedChangedListener);
    this.host.__tabs = tabs;
    this.host.stateTarget = tabs;
    this.__tabsItemsChangedListener();
  }

  teardownNode(tabs) {
    this.tabs = null;
    tabs.removeEventListener('items-changed', this.__tabsItemsChangedListener);
    tabs.removeEventListener('selected-changed', this.__tabsSelectedChangedListener);
    this.host.__tabs = null;
    this.host._setItems([]);
    this.host.stateTarget = undefined;
  }
}

/**
 * @polymerMixin
 * @mixes DelegateStateMixin
 */
export const TabSheetMixin = (superClass) =>
  class extends DelegateStateMixin(superClass) {
    static get properties() {
      return {
        /**
         * The list of `<vaadin-tab>`s from which a selection can be made.
         * It is populated from the elements passed inside the slotted
         * `<vaadin-tabs>`, and updated dynamically when adding or removing items.
         *
         * Note: unlike `<vaadin-combo-box>`, this property is read-only.
         * @type {!Array<!Tab> | undefined}
         */
        items: {
          type: Array,
          readOnly: true,
          notify: true,
        },

        /**
         * The index of the selected tab.
         */
        selected: {
          value: 0,
          type: Number,
          notify: true,
        },

        /**
         * The slotted <vaadin-tabs> element.
         */
        __tabs: {
          type: Object,
        },

        /**
         * The panel elements.
         */
        __panels: {
          type: Array,
        },
      };
    }

    static get observers() {
      return ['__itemsOrPanelsChanged(items, __panels)', '__selectedTabItemChanged(selected, items, __panels)'];
    }

    /** @override */
    static get delegateProps() {
      return ['selected'];
    }

    /** @override */
    static get delegateAttrs() {
      return ['theme'];
    }

    /** @protected */
    ready() {
      super.ready();
      this.__overflowController = new OverflowController(this, this.shadowRoot.querySelector('[part="content"]'));
      this.addController(this.__overflowController);
      this._tabsSlotController = new TabsSlotController(this);
      this.addController(this._tabsSlotController);

      // Observe the panels slot for nodes. Set the assigned element nodes as the __panels array.
      const panelSlot = this.shadowRoot.querySelector('#panel-slot');
      this.__panelsObserver = new SlotObserver(panelSlot, () => {
        this.__panels = Array.from(
          panelSlot.assignedNodes({
            flatten: true,
          }),
        ).filter((node) => node.nodeType === Node.ELEMENT_NODE);
      });
    }

    /**
     * An observer which applies the necessary roles and ARIA attributes
     * to associate the tab elements with the panels.
     * @private
     */
    __itemsOrPanelsChanged(items, panels) {
      if (!items || !panels) {
        return;
      }
      items.forEach((tabItem) => {
        const panel = panels.find((panel) => panel.getAttribute('tab') === tabItem.id);
        if (panel) {
          panel.role = 'tabpanel';
          if (!panel.id) {
            panel.id = `tabsheet-panel-${generateUniqueId()}`;
          }
          panel.setAttribute('aria-labelledby', tabItem.id);
          tabItem.setAttribute('aria-controls', panel.id);
        }
      });
    }

    /**
     * An observer which toggles the visibility of the panels based on the selected tab.
     * @private
     */
    __selectedTabItemChanged(selected, items, panels) {
      if (!items || !panels || selected === undefined) {
        return;
      }
      const content = this.shadowRoot.querySelector('[part="content"]');
      const selectedTab = items[selected];
      const selectedTabId = selectedTab ? selectedTab.id : '';
      const selectedPanel = panels.find((panel) => panel.getAttribute('tab') === selectedTabId);

      // Mark loading state if a selected panel is not found.
      this.toggleAttribute('loading', !selectedPanel);
      const hasOneVisiblePanel = panels.filter((panel) => !panel.hidden).length === 1;
      if (selectedPanel) {
        // A selected panel is found, remove the loading state fallback height.
        content.style.minHeight = '';
      } else if (hasOneVisiblePanel) {
        // Make sure the empty content has a fallback height in loading state..
        content.style.minHeight = `${content.offsetHeight}px`;
      }

      // Hide all panels and show only the selected panel.
      panels.forEach((panel) => {
        panel.hidden = panel !== selectedPanel;
      });
    }
  };
