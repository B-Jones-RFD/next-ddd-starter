<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'

import { data as adrs } from './adrs.data'

const { frontmatter } = useData()

// The drift check fails the build on an unknown number, so every cited ADR resolves here.
const cited = computed(() =>
  ((frontmatter.value.adrs ?? []) as string[]).map(String).flatMap((n) => {
    const adr = adrs[n]
    return adr ? [adr] : []
  }),
)
</script>

<template>
  <section v-if="cited.length" class="adr-list">
    <h2 id="decisions-behind-this-page" tabindex="-1">
      Decisions behind this page
      <a class="header-anchor" href="#decisions-behind-this-page" aria-label='Permalink to "Decisions behind this page"'>&#8203;</a>
    </h2>
    <ul>
      <li v-for="adr in cited" :key="adr.number">
        <a :href="adr.url" target="_blank" rel="noreferrer">ADR {{ adr.number }}: {{ adr.title }}</a>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.adr-list {
  margin-top: 48px;
}
</style>
