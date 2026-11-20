<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { Banner } from '@/types'

const props = defineProps<{ banners: Banner[] }>()

// 只展示配置了图片且已启用的轮播图，图片地址由后端根据附件ID生成
const items = computed(() => props.banners.filter(banner => !!banner.imageUrl))
const active = ref(0)
const paused = ref(false)
// 图片按ID记录加载状态：缓存命中时立即淡入，未命中时用底色占位平滑过渡，避免大片空白突然闪出
const loaded = ref<Record<string, boolean>>({})
let timer: ReturnType<typeof setInterval> | null = null

function go(index: number) {
  if (!items.value.length) return
  active.value = (index + items.value.length) % items.value.length
}

function open(banner: Banner) {
  const url = banner.linkUrl.trim()
  if (!url) return
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
  else window.location.assign(url)
}

function start() {
  stop()
  if (items.value.length > 1) {
    timer = setInterval(() => { if (!paused.value) go(active.value + 1) }, 4500)
  }
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(start)
onUnmounted(stop)
</script>

<template>
  <div v-if="items.length" class="banner-carousel" @mouseenter="paused = true" @mouseleave="paused = false">
    <div class="banner-track" :style="{ transform: `translateX(-${active * 100}%)` }">
      <div v-for="(banner, index) in items" :key="banner.id" class="banner-slide" @click="open(banner)">
        <img :src="banner.imageUrl!" :alt="banner.title || '轮播图'"
             :loading="index === 0 ? 'eager' : 'lazy'" :class="{ loaded: loaded[banner.id] }"
             @load="loaded[banner.id] = true" />
      </div>
    </div>
    <template v-if="items.length > 1">
      <button class="banner-arrow banner-arrow-prev" aria-label="上一张" @click="go(active - 1)">‹</button>
      <button class="banner-arrow banner-arrow-next" aria-label="下一张" @click="go(active + 1)">›</button>
      <div class="banner-dots">
        <button v-for="(banner, index) in items" :key="banner.id" :class="{ active: index === active }" :aria-label="`第 ${index + 1} 张`" @click="go(index)" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.banner-carousel {
  position: relative;
  height: 300px;
  margin-top: 24px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--soft);
}
.banner-track { display: flex; height: 100%; transition: transform .5s ease; }
.banner-slide { flex: 0 0 100%; height: 100%; cursor: pointer; line-height: 0; }
.banner-slide img { width: 100%; height: 100%; display: block; object-fit: cover; opacity: 0; transition: opacity .35s ease; }
.banner-slide img.loaded { opacity: 1; }
.banner-arrow {
  position: absolute;
  top: 50%;
  width: 34px;
  height: 46px;
  border: 0;
  border-radius: 8px;
  background: rgb(0 0 0 / 32%);
  color: #fff;
  font-size: 26px;
  line-height: 1;
  transform: translateY(-50%);
  opacity: .75;
  transition: opacity .18s;
}
.banner-arrow:hover { opacity: 1; }
.banner-arrow-prev { left: 12px; }
.banner-arrow-next { right: 12px; }
.banner-dots {
  position: absolute;
  bottom: 12px;
  left: 50%;
  display: flex;
  gap: 7px;
  transform: translateX(-50%);
}
.banner-dots button {
  width: 8px;
  height: 8px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 55%);
  transition: background .18s, width .18s;
}
.banner-dots button.active { width: 20px; border-radius: 5px; background: #fff; }
</style>
