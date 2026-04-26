/**
 * @module
 * Solid Lite - A minimalist reactive UI library.
 * 
 * This module provides the core reactivity and rendering engine for Solid Lite.
 */

const sharedConfig = {
    context: undefined,
    registry: undefined,
    effects: undefined,
    done: false,
    getContextId () {
        return getContextId(this.context.count);
    },
    getNextContextId () {
        return getContextId(this.context.count++);
    }
};
function getContextId(count) {
    const num = String(count), len = num.length - 1;
    return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
    sharedConfig.context = context;
}
const equalFn = (a, b)=>a === b;
Symbol("solid-proxy");
typeof Proxy === "function";
Symbol("solid-track");
Symbol("solid-dev-component");
const signalOptions = {
    equals: equalFn
};
let ERROR = null;
let runEffects = runQueue;
const STALE = 1;
const PENDING = 2;
const UNOWNED = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null
};
var Owner = null;
let Transition = null;
let Scheduler = null;
let ExternalSourceConfig = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;
function createRoot(fn, detachedOwner) {
    const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === undefined ? owner : detachedOwner, root = unowned ? UNOWNED : {
        owned: null,
        cleanups: null,
        context: current ? current.context : null,
        owner: current
    }, updateFn = unowned ? fn : ()=>fn(()=>untrack(()=>cleanNode(root)));
    Owner = root;
    Listener = null;
    try {
        return runUpdates(updateFn, true);
    } finally{
        Listener = listener;
        Owner = owner;
    }
}
function createSignal(value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const s = {
        value,
        observers: null,
        observerSlots: null,
        comparator: options.equals || undefined
    };
    const setter = (value)=>{
        if (typeof value === "function") {
            if (Transition && Transition.running && Transition.sources.has(s)) value = value(s.tValue);
            else value = value(s.value);
        }
        return writeSignal(s, value);
    };
    return [
        readSignal.bind(s),
        setter
    ];
}
function createRenderEffect(fn, value, options) {
    const c = createComputation(fn, value, false, 1);
    if (Scheduler && Transition && Transition.running) Updates.push(c);
    else updateComputation(c);
}
function createEffect(fn, value, options) {
    runEffects = runUserEffects;
    const c = createComputation(fn, value, false, 1), s = SuspenseContext && useContext(SuspenseContext);
    if (s) c.suspense = s;
    if (!options || !options.render) c.user = true;
    Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
    options = options ? Object.assign({}, signalOptions, options) : signalOptions;
    const c = createComputation(fn, value, true, 0);
    c.observers = null;
    c.observerSlots = null;
    c.comparator = options.equals || undefined;
    if (Scheduler && Transition && Transition.running) {
        c.tState = STALE;
        Updates.push(c);
    } else updateComputation(c);
    return readSignal.bind(c);
}
function untrack(fn) {
    if (!ExternalSourceConfig && Listener === null) return fn();
    const listener = Listener;
    Listener = null;
    try {
        if (ExternalSourceConfig) return ExternalSourceConfig.untrack(fn);
        return fn();
    } finally{
        Listener = listener;
    }
}
function onCleanup(fn) {
    if (Owner === null) ;
    else if (Owner.cleanups === null) Owner.cleanups = [
        fn
    ];
    else Owner.cleanups.push(fn);
    return fn;
}
function startTransition(fn) {
    if (Transition && Transition.running) {
        fn();
        return Transition.done;
    }
    const l = Listener;
    const o = Owner;
    return Promise.resolve().then(()=>{
        Listener = l;
        Owner = o;
        let t;
        if (Scheduler || SuspenseContext) {
            t = Transition || (Transition = {
                sources: new Set(),
                effects: [],
                promises: new Set(),
                disposed: new Set(),
                queue: new Set(),
                running: true
            });
            t.done || (t.done = new Promise((res)=>t.resolve = res));
            t.running = true;
        }
        runUpdates(fn, false);
        Listener = Owner = null;
        return t ? t.done : undefined;
    });
}
const [transPending, setTransPending] = createSignal(false);
function createContext(defaultValue, options) {
    const id = Symbol("context");
    return {
        id,
        Provider: createProvider(id),
        defaultValue
    };
}
function useContext(context) {
    let value;
    return Owner && Owner.context && (value = Owner.context[context.id]) !== undefined ? value : context.defaultValue;
}
function children(fn) {
    const children = createMemo(fn);
    const memo = createMemo(()=>resolveChildren(children()));
    memo.toArray = ()=>{
        const c = memo();
        return Array.isArray(c) ? c : c != null ? [
            c
        ] : [];
    };
    return memo;
}
let SuspenseContext;
function readSignal() {
    const runningTransition = Transition && Transition.running;
    if (this.sources && (runningTransition ? this.tState : this.state)) {
        if ((runningTransition ? this.tState : this.state) === 1) updateComputation(this);
        else {
            const updates = Updates;
            Updates = null;
            runUpdates(()=>lookUpstream(this), false);
            Updates = updates;
        }
    }
    if (Listener) {
        const sSlot = this.observers ? this.observers.length : 0;
        if (!Listener.sources) {
            Listener.sources = [
                this
            ];
            Listener.sourceSlots = [
                sSlot
            ];
        } else {
            Listener.sources.push(this);
            Listener.sourceSlots.push(sSlot);
        }
        if (!this.observers) {
            this.observers = [
                Listener
            ];
            this.observerSlots = [
                Listener.sources.length - 1
            ];
        } else {
            this.observers.push(Listener);
            this.observerSlots.push(Listener.sources.length - 1);
        }
    }
    if (runningTransition && Transition.sources.has(this)) return this.tValue;
    return this.value;
}
function writeSignal(node, value, isComp) {
    let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
    if (!node.comparator || !node.comparator(current, value)) {
        if (Transition) {
            const TransitionRunning = Transition.running;
            if (TransitionRunning || !isComp && Transition.sources.has(node)) {
                Transition.sources.add(node);
                node.tValue = value;
            }
            if (!TransitionRunning) node.value = value;
        } else node.value = value;
        if (node.observers && node.observers.length) {
            runUpdates(()=>{
                for(let i = 0; i < node.observers.length; i += 1){
                    const o = node.observers[i];
                    const TransitionRunning = Transition && Transition.running;
                    if (TransitionRunning && Transition.disposed.has(o)) continue;
                    if (TransitionRunning ? !o.tState : !o.state) {
                        if (o.pure) Updates.push(o);
                        else Effects.push(o);
                        if (o.observers) markDownstream(o);
                    }
                    if (!TransitionRunning) o.state = STALE;
                    else o.tState = STALE;
                }
                if (Updates.length > 10e5) {
                    Updates = [];
                    if (false) ;
                    throw new Error();
                }
            }, false);
        }
    }
    return value;
}
function updateComputation(node) {
    if (!node.fn) return;
    cleanNode(node);
    const time = ExecCount;
    runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
    if (Transition && !Transition.running && Transition.sources.has(node)) {
        queueMicrotask(()=>{
            runUpdates(()=>{
                Transition && (Transition.running = true);
                Listener = Owner = node;
                runComputation(node, node.tValue, time);
                Listener = Owner = null;
            }, false);
        });
    }
}
function runComputation(node, value, time) {
    let nextValue;
    const owner = Owner, listener = Listener;
    Listener = Owner = node;
    try {
        nextValue = node.fn(value);
    } catch (err) {
        if (node.pure) {
            if (Transition && Transition.running) {
                node.tState = STALE;
                node.tOwned && node.tOwned.forEach(cleanNode);
                node.tOwned = undefined;
            } else {
                node.state = STALE;
                node.owned && node.owned.forEach(cleanNode);
                node.owned = null;
            }
        }
        node.updatedAt = time + 1;
        return handleError(err);
    } finally{
        Listener = listener;
        Owner = owner;
    }
    if (!node.updatedAt || node.updatedAt <= time) {
        if (node.updatedAt != null && "observers" in node) {
            writeSignal(node, nextValue, true);
        } else if (Transition && Transition.running && node.pure) {
            Transition.sources.add(node);
            node.tValue = nextValue;
        } else node.value = nextValue;
        node.updatedAt = time;
    }
}
function createComputation(fn, init, pure, state = 1, options) {
    const c = {
        fn,
        state: state,
        updatedAt: null,
        owned: null,
        sources: null,
        sourceSlots: null,
        cleanups: null,
        value: init,
        owner: Owner,
        context: Owner ? Owner.context : null,
        pure
    };
    if (Transition && Transition.running) {
        c.state = 0;
        c.tState = state;
    }
    if (Owner === null) ;
    else if (Owner !== UNOWNED) {
        if (Transition && Transition.running && Owner.pure) {
            if (!Owner.tOwned) Owner.tOwned = [
                c
            ];
            else Owner.tOwned.push(c);
        } else {
            if (!Owner.owned) Owner.owned = [
                c
            ];
            else Owner.owned.push(c);
        }
    }
    if (ExternalSourceConfig && c.fn) {
        const [track, trigger] = createSignal(undefined, {
            equals: false
        });
        const ordinary = ExternalSourceConfig.factory(c.fn, trigger);
        onCleanup(()=>ordinary.dispose());
        const triggerInTransition = ()=>startTransition(trigger).then(()=>inTransition.dispose());
        const inTransition = ExternalSourceConfig.factory(c.fn, triggerInTransition);
        c.fn = (x)=>{
            track();
            return Transition && Transition.running ? inTransition.track(x) : ordinary.track(x);
        };
    }
    return c;
}
function runTop(node) {
    const runningTransition = Transition && Transition.running;
    if ((runningTransition ? node.tState : node.state) === 0) return;
    if ((runningTransition ? node.tState : node.state) === 2) return lookUpstream(node);
    if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
    const ancestors = [
        node
    ];
    while((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)){
        if (runningTransition && Transition.disposed.has(node)) return;
        if (runningTransition ? node.tState : node.state) ancestors.push(node);
    }
    for(let i = ancestors.length - 1; i >= 0; i--){
        node = ancestors[i];
        if (runningTransition) {
            let top = node, prev = ancestors[i + 1];
            while((top = top.owner) && top !== prev){
                if (Transition.disposed.has(top)) return;
            }
        }
        if ((runningTransition ? node.tState : node.state) === 1) {
            updateComputation(node);
        } else if ((runningTransition ? node.tState : node.state) === 2) {
            const updates = Updates;
            Updates = null;
            runUpdates(()=>lookUpstream(node, ancestors[0]), false);
            Updates = updates;
        }
    }
}
function runUpdates(fn, init) {
    if (Updates) return fn();
    let wait = false;
    if (!init) Updates = [];
    if (Effects) wait = true;
    else Effects = [];
    ExecCount++;
    try {
        const res = fn();
        completeUpdates(wait);
        return res;
    } catch (err) {
        if (!wait) Effects = null;
        Updates = null;
        handleError(err);
    }
}
function completeUpdates(wait) {
    if (Updates) {
        if (Scheduler && Transition && Transition.running) scheduleQueue(Updates);
        else runQueue(Updates);
        Updates = null;
    }
    if (wait) return;
    let res;
    if (Transition) {
        if (!Transition.promises.size && !Transition.queue.size) {
            const sources = Transition.sources;
            const disposed = Transition.disposed;
            Effects.push.apply(Effects, Transition.effects);
            res = Transition.resolve;
            for (const e of Effects){
                "tState" in e && (e.state = e.tState);
                delete e.tState;
            }
            Transition = null;
            runUpdates(()=>{
                for (const d of disposed)cleanNode(d);
                for (const v of sources){
                    v.value = v.tValue;
                    if (v.owned) {
                        for(let i = 0, len = v.owned.length; i < len; i++)cleanNode(v.owned[i]);
                    }
                    if (v.tOwned) v.owned = v.tOwned;
                    delete v.tValue;
                    delete v.tOwned;
                    v.tState = 0;
                }
                setTransPending(false);
            }, false);
        } else if (Transition.running) {
            Transition.running = false;
            Transition.effects.push.apply(Transition.effects, Effects);
            Effects = null;
            setTransPending(true);
            return;
        }
    }
    const e = Effects;
    Effects = null;
    if (e.length) runUpdates(()=>runEffects(e), false);
    if (res) res();
}
function runQueue(queue) {
    for(let i = 0; i < queue.length; i++)runTop(queue[i]);
}
function scheduleQueue(queue) {
    for(let i = 0; i < queue.length; i++){
        const item = queue[i];
        const tasks = Transition.queue;
        if (!tasks.has(item)) {
            tasks.add(item);
            Scheduler(()=>{
                tasks.delete(item);
                runUpdates(()=>{
                    Transition.running = true;
                    runTop(item);
                }, false);
                Transition && (Transition.running = false);
            });
        }
    }
}
function runUserEffects(queue) {
    let i, userLength = 0;
    for(i = 0; i < queue.length; i++){
        const e = queue[i];
        if (!e.user) runTop(e);
        else queue[userLength++] = e;
    }
    if (sharedConfig.context) {
        if (sharedConfig.count) {
            sharedConfig.effects || (sharedConfig.effects = []);
            sharedConfig.effects.push(...queue.slice(0, userLength));
            return;
        }
        setHydrateContext();
    }
    if (sharedConfig.effects && (sharedConfig.done || !sharedConfig.count)) {
        queue = [
            ...sharedConfig.effects,
            ...queue
        ];
        userLength += sharedConfig.effects.length;
        delete sharedConfig.effects;
    }
    for(i = 0; i < userLength; i++)runTop(queue[i]);
}
function lookUpstream(node, ignore) {
    const runningTransition = Transition && Transition.running;
    if (runningTransition) node.tState = 0;
    else node.state = 0;
    for(let i = 0; i < node.sources.length; i += 1){
        const source = node.sources[i];
        if (source.sources) {
            const state = runningTransition ? source.tState : source.state;
            if (state === 1) {
                if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
            } else if (state === 2) lookUpstream(source, ignore);
        }
    }
}
function markDownstream(node) {
    const runningTransition = Transition && Transition.running;
    for(let i = 0; i < node.observers.length; i += 1){
        const o = node.observers[i];
        if (runningTransition ? !o.tState : !o.state) {
            if (runningTransition) o.tState = PENDING;
            else o.state = PENDING;
            if (o.pure) Updates.push(o);
            else Effects.push(o);
            o.observers && markDownstream(o);
        }
    }
}
function cleanNode(node) {
    let i;
    if (node.sources) {
        while(node.sources.length){
            const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
            if (obs && obs.length) {
                const n = obs.pop(), s = source.observerSlots.pop();
                if (index < obs.length) {
                    n.sourceSlots[s] = index;
                    obs[index] = n;
                    source.observerSlots[index] = s;
                }
            }
        }
    }
    if (node.tOwned) {
        for(i = node.tOwned.length - 1; i >= 0; i--)cleanNode(node.tOwned[i]);
        delete node.tOwned;
    }
    if (Transition && Transition.running && node.pure) {
        reset(node, true);
    } else if (node.owned) {
        for(i = node.owned.length - 1; i >= 0; i--)cleanNode(node.owned[i]);
        node.owned = null;
    }
    if (node.cleanups) {
        for(i = node.cleanups.length - 1; i >= 0; i--)node.cleanups[i]();
        node.cleanups = null;
    }
    if (Transition && Transition.running) node.tState = 0;
    else node.state = 0;
}
function reset(node, top) {
    if (!top) {
        node.tState = 0;
        Transition.disposed.add(node);
    }
    if (node.owned) {
        for(let i = 0; i < node.owned.length; i++)reset(node.owned[i]);
    }
}
function castError(err) {
    if (err instanceof Error) return err;
    return new Error(typeof err === "string" ? err : "Unknown error", {
        cause: err
    });
}
function runErrors(err, fns, owner) {
    try {
        for (const f of fns)f(err);
    } catch (e) {
        handleError(e, owner && owner.owner || null);
    }
}
function handleError(err, owner = Owner) {
    const fns = ERROR && owner && owner.context && owner.context[ERROR];
    const error = castError(err);
    if (!fns) throw error;
    if (Effects) Effects.push({
        fn () {
            runErrors(error, fns, owner);
        },
        state: 1
    });
    else runErrors(error, fns, owner);
}
function resolveChildren(children) {
    if (typeof children === "function" && !children.length) return resolveChildren(children());
    if (Array.isArray(children)) {
        const results = [];
        for(let i = 0; i < children.length; i++){
            const result = resolveChildren(children[i]);
            Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
        }
        return results;
    }
    return children;
}
function createProvider(id, options) {
    return function provider(props) {
        let res;
        createRenderEffect(()=>res = untrack(()=>{
                Owner.context = {
                    ...Owner.context,
                    [id]: props.value
                };
                return children(()=>props.children);
            }), undefined);
        return res;
    };
}
Symbol("fallback");
createContext();
const DISPOSE = Symbol("d");
const HANDLERS = Symbol("h");
const delegatedEvents = new Set();
function delegateEvent(el, eventName, handler) {
    const node = el;
    if (!node[HANDLERS]) node[HANDLERS] = {};
    node[HANDLERS][eventName] = handler;
    if (!delegatedEvents.has(eventName)) {
        delegatedEvents.add(eventName);
        document.addEventListener(eventName, (e)=>{
            let target = e.target;
            while(target && target !== document){
                const h = target[HANDLERS]?.[eventName];
                if (h) {
                    h.call(target, e);
                    if (e.cancelBubble) break;
                }
                target = target.parentNode;
            }
        });
    }
}
function undelegateEvent(el, eventName) {
    const node = el;
    if (node[HANDLERS]) delete node[HANDLERS][eventName];
}
function isRefObject(x) {
    return !!x && typeof x === "object" && "current" in x;
}
function isInnerHTML(x) {
    return !!x && typeof x === "object" && "__html" in x;
}
function isSignalGetter(x) {
    return typeof x === "function" && x.length === 0;
}
const CAMEL_TO_KEBAB = /[A-Z]/g;
function camelToKebab(k) {
    return k.startsWith("--") ? k : k.replace(CAMEL_TO_KEBAB, (m)=>"-" + m.toLowerCase());
}
function normalizeStyle(input) {
    if (!input) return {};
    if (typeof input === "string") {
        const out = {};
        for (const decl of input.split(";")){
            const i = decl.indexOf(":");
            if (i === -1) continue;
            const key = decl.slice(0, i).trim();
            const val = decl.slice(i + 1).trim();
            if (key) out[key] = val;
        }
        return out;
    }
    const out = {};
    for(const k in input){
        const v = input[k];
        out[camelToKebab(k)] = v == null ? "" : typeof v === "number" ? String(v) : String(v);
    }
    return out;
}
const PREV_STYLES = new WeakMap();
const DYN_STYLE_KEYS = new WeakMap();
function applyStyle(el, next) {
    const prev = PREV_STYLES.get(el) || {};
    const dyn = DYN_STYLE_KEYS.get(el) || new Set();
    for(const k in prev){
        if (!(k in next) && !dyn.has(k)) el.style.removeProperty(k);
    }
    for(const k in next){
        const nv = next[k] ?? "";
        if (prev[k] !== nv) el.style.setProperty(k, String(nv));
    }
    PREV_STYLES.set(el, next);
}
function setAttr(el, name, value) {
    if (name === "className") name = "class";
    if (name === "dangerouslySetInnerHTML" && isInnerHTML(value)) {
        const rawHtml = value.__html == null ? "" : String(value.__html);
        const doc = new DOMParser().parseFromString(rawHtml, "text/html");
        const scripts = doc.querySelectorAll("script");
        for(let i = 0; i < scripts.length; i++){
            scripts[i].parentNode?.removeChild(scripts[i]);
        }
        const all = doc.querySelectorAll("*");
        for(let i = 0; i < all.length; i++){
            const node = all[i];
            for(let j = node.attributes.length - 1; j >= 0; j--){
                const attr = node.attributes[j];
                if (attr.name.toLowerCase().startsWith("on")) {
                    node.removeAttribute(attr.name);
                }
                if (attr.name.toLowerCase() === "href" || attr.name.toLowerCase() === "src") {
                    const val = attr.value.trim().toLowerCase();
                    if (val.startsWith("javascript:") || val.startsWith("data:") || val.startsWith("vbscript:")) {
                        node.setAttribute(attr.name, "about:blank");
                    }
                }
            }
        }
        el.innerHTML = doc.body.innerHTML;
        return;
    }
    if (name === "ref") {
        const r = value;
        if (typeof r === "function") {
            r(el);
            onCleanup(()=>r(null));
        } else if (isRefObject(r)) {
            r.current = el;
            onCleanup(()=>{
                r.current = null;
            });
        }
        return;
    }
    if (name === "style") {
        const elh = el;
        if (isSignalGetter(value)) {
            createEffect(()=>{
                const v = value();
                applyStyle(elh, normalizeStyle(v));
            });
            return;
        }
        if (typeof value === "string") {
            applyStyle(elh, normalizeStyle(value));
            return;
        }
        if (typeof value === "object" && value !== null) {
            const obj = value;
            const dyn = DYN_STYLE_KEYS.get(elh) || new Set();
            DYN_STYLE_KEYS.set(elh, dyn);
            const staticObj = {};
            for(const k in obj){
                const v = obj[k];
                if (isSignalGetter(v)) {
                    const name = camelToKebab(k);
                    dyn.add(name);
                    createEffect(()=>{
                        const nv = v();
                        if (nv == null) elh.style.removeProperty(name);
                        else elh.style.setProperty(name, String(nv));
                    });
                } else {
                    staticObj[k] = v;
                }
            }
            applyStyle(elh, normalizeStyle(staticObj));
            return;
        }
    }
    if (/^on[A-Z]/.test(name) && typeof value === "function") {
        const ev = name.slice(2).toLowerCase();
        const handler = value;
        delegateEvent(el, ev, handler);
        onCleanup(()=>undelegateEvent(el, ev));
        return;
    }
    if (name === "value") {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
            if (isSignalGetter(value)) {
                createEffect(()=>{
                    const v = value();
                    el.value = v == null ? "" : String(v);
                });
            } else {
                el.value = value == null ? "" : String(value);
            }
            return;
        }
    }
    if (name === "checked" && el instanceof HTMLInputElement) {
        if (isSignalGetter(value)) {
            createEffect(()=>{
                el.checked = Boolean(value());
            });
        } else {
            el.checked = Boolean(value);
        }
        return;
    }
    if (typeof value === "boolean") {
        if (value) el.setAttribute(name, "");
        else el.removeAttribute(name);
        return;
    }
    if (isSignalGetter(value)) {
        createEffect(()=>{
            const v = value();
            if (v == null || v === false) el.removeAttribute(name);
            else el.setAttribute(name, v === true ? "" : String(v));
        });
    } else {
        if (value == null || value === false) el.removeAttribute(name);
        else el.setAttribute(name, value === true ? "" : String(value));
    }
}
function normalizeToNodes(value) {
    if (value == null || value === false || value === true) return [];
    if (value instanceof Node) return [
        value
    ];
    if (typeof value === "function") return normalizeToNodes(value());
    if (Array.isArray(value)) {
        const out = [];
        for (const v of value.flat()){
            out.push(...normalizeToNodes(v));
        }
        return out;
    }
    return [
        document.createTextNode(String(value))
    ];
}
function disposeNode(n) {
    const d = n[DISPOSE];
    if (d) {
        try {
            d();
        } catch  {}
    }
}
function clearRange(start, end) {
    let n = start.nextSibling;
    while(n && n !== end){
        const next = n.nextSibling;
        disposeNode(n);
        n.parentNode?.removeChild(n);
        n = next;
    }
}
function insertNodesAfter(ref, nodes) {
    let cursor = ref;
    for (const n of nodes){
        if (cursor.nextSibling) ref.parentNode.insertBefore(n, cursor.nextSibling);
        else ref.parentNode.appendChild(n);
        cursor = n;
    }
}
function insertNodes(nodes, before) {
    if (nodes.length === 0) return;
    const parent = before.parentNode;
    if (nodes.length === 1) {
        parent.insertBefore(nodes[0], before);
        return;
    }
    const f = document.createDocumentFragment();
    for (const n of nodes)f.appendChild(n);
    parent.insertBefore(f, before);
}
function appendDynamic(parent, getter) {
    const start = document.createComment("");
    const end = document.createComment("");
    parent.appendChild(start);
    parent.appendChild(end);
    createEffect(()=>{
        const v = getter();
        const nodes = normalizeToNodes(v);
        clearRange(start, end);
        insertNodesAfter(start, nodes);
    });
}
function appendStatic(parent, child) {
    if (child == null || child === false || child === true) return;
    if (Array.isArray(child)) {
        for (const c of child){
            appendStatic(parent, c);
        }
        return;
    }
    if (child instanceof Node) {
        parent.appendChild(child);
    } else {
        parent.appendChild(document.createTextNode(String(child)));
    }
}
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set([
    "svg",
    "path",
    "g",
    "defs",
    "clipPath",
    "mask",
    "pattern",
    "linearGradient",
    "radialGradient",
    "stop",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "rect",
    "use",
    "symbol",
    "marker",
    "text",
    "tspan",
    "textPath",
    "foreignObject",
    "filter",
    "feGaussianBlur",
    "feOffset",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "title",
    "desc"
]);
function h(tag, props, ...children) {
    if (typeof tag === "function") {
        let dispose = ()=>{};
        const node = createRoot((d)=>{
            dispose = d;
            return tag({
                ...props || {},
                children
            });
        });
        if (node) node[DISPOSE] = dispose;
        return node;
    }
    const isSvg = SVG_TAGS.has(tag);
    const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props))setAttr(el, k, v);
    }
    for (const c of children.flat()){
        if (isSignalGetter(c)) appendDynamic(el, c);
        else appendStatic(el, c);
    }
    return el;
}
function Fragment(props = {}, ...kids) {
    const list = props.children ?? kids;
    const f = document.createDocumentFragment();
    for (const k of (list ?? []).flat()){
        if (isSignalGetter(k)) appendDynamic(f, k);
        else appendStatic(f, k);
    }
    return f;
}
function render(node, container) {
    container.textContent = "";
    container.appendChild(node);
}
function Show(props) {
    const start = document.createComment("show-start");
    const end = document.createComment("show-end");
    const frag = document.createDocumentFragment();
    frag.appendChild(start);
    frag.appendChild(end);
    createEffect(()=>{
        const next = !!props.when();
        clearRange(start, end);
        const content = next ? props.children : props.fallback;
        const contentToRender = typeof content === "function" ? content() : content;
        if (contentToRender && end.parentNode) {
            insertNodes(normalizeToNodes(contentToRender), end);
        }
    });
    return frag;
}
function For(props) {
    const start = document.createComment("for-start");
    const end = document.createComment("for-end");
    const frag = document.createDocumentFragment();
    frag.appendChild(start);
    frag.appendChild(end);
    const renderFn = typeof props.children === "function" ? props.children : Array.isArray(props.children) && typeof props.children[0] === "function" ? props.children[0] : undefined;
    if (!renderFn) return frag;
    const cache = new Map();
    createEffect(()=>{
        const list = props.each() || [];
        const keyFn = props.key || ((item)=>item);
        const parent = end.parentNode;
        if (!parent) return;
        const newKeys = list.map(keyFn);
        const newKeySet = new Set(newKeys);
        for (const [key, cached] of cache.entries()){
            if (!newKeySet.has(key)) {
                cached.dispose();
                cached.nodes.forEach((n)=>{
                    disposeNode(n);
                    n.parentNode?.removeChild(n);
                });
                cache.delete(key);
            }
        }
        let cursor = start;
        newKeys.forEach((key, i)=>{
            const item = list[i];
            let cached = cache.get(key);
            if (!cached) {
                let setIndex = ()=>{};
                let dispose = ()=>{};
                const nodes = createRoot((d)=>{
                    dispose = d;
                    const [index, _setIndex] = createSignal(i);
                    setIndex = _setIndex;
                    return normalizeToNodes(renderFn(item, index));
                });
                cached = {
                    nodes,
                    dispose,
                    setIndex
                };
                cache.set(key, cached);
            } else {
                cached.setIndex(i);
            }
            const firstNode = cached.nodes[0];
            if (firstNode && firstNode.previousSibling !== cursor) {
                const next = cursor.nextSibling;
                cached.nodes.forEach((n)=>{
                    if (next) parent.insertBefore(n, next);
                    else parent.appendChild(n);
                });
            }
            if (cached.nodes.length > 0) {
                cursor = cached.nodes[cached.nodes.length - 1];
            }
        });
    });
    return frag;
}
function Switch(props) {
    const start = document.createComment("switch-start");
    const end = document.createComment("switch-end");
    const frag = document.createDocumentFragment();
    frag.appendChild(start);
    frag.appendChild(end);
    createEffect(()=>{
        clearRange(start, end);
        let matched = false;
        for (const child of props.children){
            const matchNode = child;
            if (matchNode?.__isMatch) {
                if (matchNode.condition()) {
                    insertNodes(normalizeToNodes(matchNode.children), end);
                    matched = true;
                    break;
                }
            }
        }
        if (!matched && props.fallback) {
            insertNodes(normalizeToNodes(props.fallback), end);
        }
    });
    return frag;
}
function Match(props) {
    return {
        condition: ()=>!!props.when(),
        children: props.children,
        __isMatch: true
    };
}
export { createRoot as createRoot };
export { createSignal as createSignal };
export { createEffect as createEffect };
export { onCleanup as onCleanup };
export { h as h };
export { Fragment as Fragment };
export { render as render };
export { Show as Show };
export { For as For };
export { Switch as Switch };
export { Match as Match };
