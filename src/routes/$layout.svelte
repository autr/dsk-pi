<script>
	import { onMount, onDestroy } from 'svelte'
	import { amp, browser, dev, prerendering } from '$app/env'
	import { goto, prefetch, prefetchRoutes } from '$app/navigation'
	import { navigating, page, session } from '$app/stores'

	import { store, voldown, volup, skipprev, playpause, skipnext, toggle } from '$lib/store.js'

	let inited = false
	let error

	$: info = $store.current.info
	$: playlist = $store.playlist

	onMount(async () => {
		const res = await store.fetch()
		const idx = playlist.map( i => i.slug ).indexOf( $page.params.slug )
		if (idx != -1) store.index( idx )
		if (res.success) inited = true
		if (res.error) error = res.error
		wsPoll()
	})

	// create button and keys config

	let lookup = []
	const add = ( ref, keys, subscribe ) => lookup.push( { ref, keys, subscribe } )

	add( voldown, ['-', '_'], async b => {

	})
	add( volup, ['=', '+'], async b => {
	})
	add( playpause, [' '], async b => {

		if (!b) {
			const { params } = $page
			if (!params.time) return hardGoto(`/${info.slug}/${$store.intro}`)
		}
	})
	add( toggle, ['Enter', 'Tab'], async b => {
		if (!b) return
		const {info} = $store.current
		const home = $page.path == '/'
		if (home) goto(`/${info.slug}`)
		if (!home) goto(`/`)

	})
	add( skipprev, ['ArrowUp', 'ArrowLeft'], async b => {
		if (!b) {
			const i = await store.prev()
			const { params } = $page
			if (params.slug && params.time) return hardGoto(`/${i.slug}/${$store.intro}`)
			if (params.slug) return hardGoto(`/${i.slug}`)
		}
	})
	add( skipnext, ['ArrowDown', 'ArrowRight'], async b => {
		if (!b) {
			const i = await store.next()
			const { params } = $page
			if (params.slug && params.time) return hardGoto(`/${i.slug}/${$store.intro}`)
			if (params.slug) return hardGoto(`/${i.slug}`)
		}

	})

	function hardGoto( url ) {
		window.location = url
	}

	// bind subscribe and unsubscribe

	for (let i = 0; i < lookup.length; i++) {
		const { ref, subscribe } = lookup[i]
		lookup[i].unsubscribe = ref.subscribe( b => {
			if (!inited) return
			subscribe( b )
		})
	}

	onDestroy( async e => {
		for (let i = 0; i < lookup.length; i++) lookup[i].unsubscribe()
	})

	// keyup and keydown

	function trigger( e, value ) {
		for (let i = 0; i < lookup.length; i++) {
			const { ref, keys } = lookup[i]
			if ( keys.indexOf(e.key) != -1 ) {
				ref.update( u => {
					if (!value) u = value
					if (value) u += value
					return u
				})
				ref.set(value)
			}
		}
	}
	const keydown = e => trigger( e, 1 )
	const keyup = e => trigger( e, 0 )

	let ws

	function wsPoll() {
		if (!ws) {
			wsConnect()
		} else if (ws.readyState == ws.CLOSED) {
			console.log('[overview.svelte] 👁 🛑  remove CLOSED websocket...');
			ws = null
			window.websocketsClient = null
		}
		setTimeout( wsPoll, 2000)
	}
	function wsConnect() {
		if (browser && !ws) {
			const url = `ws://${window.location.hostname}:8765`
			console.log('[overview.svelte] 👁 ⚡️  opening websocket...', url)
			ws = new WebSocket(url);
			ws.addEventListener('open', onOpen)
			ws.addEventListener('message', onMessage)
			ws.addEventListener('error', onError)
			ws.addEventListener('close', onClose)
			window.websocketsClient = ws;
		}
	}
	function onOpen(e) {
		console.log('[overview.svelte] 👁 ✅  opened websocket...', e.currentTarget.url);
	}
	function onError(err) {
		console.log('[overview.svelte] 👁 ❌  error with websocket...', err);
		ws.close()
	}
	function onClose(err) {
		console.log('[overview.svelte] 👁 🛑  closed and delete websockets...');
	}
	function onMessage(e) {
		console.log('[overview.svelte] 👁 ✨  received websocket message...', e.data);
	}
	// ---------------------
	onDestroy( async() => {
		if (browser && ws) {
			console.log('[overview.svelte] 👁 🛑  closing websocket...')
			ws.close()
			window.websocketsClient = null;
		}
	});


</script>
<main class="f2 margin-auto flex grow row-center-center w100vw h100vh">
	{#if inited && !error}
		<slot />
	{/if}

	{#if error}
		<div class="flex column-center-center">
			<div class="f4 bb2-solid p1">
				error retrieving playlist
			</div>
			<div class="f4 p1" >
				{error}
			</div>
		</div>
	{/if}
</main>
<svelte:window on:keydown={ keydown } on:keyup={ keyup } />