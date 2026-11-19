<template>
  <div class="container profile-edit-page">
    <section class="profile-heading"><div><span class="eyebrow">PROFILE SETTINGS</span><h1>个人资料</h1><p>显示名、头像和封面会展示在你的公开个人主页。</p></div><RouterLink to="/me" class="secondary-button">返回个人中心</RouterLink></section>
    <div v-if="loading" class="panel page-state">正在加载个人资料…</div>
    <div v-else-if="loadError" class="panel page-state error-state"><p>{{ loadError }}</p><button class="secondary-button" @click="load">重新加载</button></div>
    <form v-else class="profile-edit-layout" @submit.prevent="save">
      <section class="panel profile-edit-card">
        <div class="member-section-heading"><h2>基本信息</h2><span>公开显示</span></div>
        <label class="form-label" for="profile-nickname">论坛显示名 <span>{{ form.nickname.length }}/50</span></label>
        <input id="profile-nickname" v-model="form.nickname" class="form-control" maxlength="50" placeholder="留空时使用 SSO 用户名" />
        <label class="form-label" for="profile-bio">个人简介 <span>{{ form.bio.length }}/500</span></label>
        <textarea id="profile-bio" v-model="form.bio" class="form-control profile-bio-input" maxlength="500" placeholder="介绍你的兴趣、经验或正在关注的内容"></textarea>
        <div class="profile-form-columns">
          <div><label class="form-label" for="profile-location">所在地</label><input id="profile-location" v-model.trim="form.location" class="form-control" maxlength="100" placeholder="例如：上海" /></div>
          <div><label class="form-label" for="profile-website">个人主页</label><input id="profile-website" v-model.trim="form.website" class="form-control" maxlength="255" type="url" placeholder="https://example.com" /></div>
        </div>
        <div class="editor-actions"><RouterLink to="/me" class="secondary-button">取消</RouterLink><button class="primary-button" :disabled="saving || uploading !== ''"><check-outlined />{{ saving ? '保存中…' : uploading ? '等待图片上传…' : '保存资料' }}</button></div>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p><p v-if="message" class="form-message success">{{ message }}</p>
      </section>

      <aside class="profile-image-column">
        <section class="panel profile-image-card">
          <div class="member-section-heading"><h2>头像</h2><span>图片，最大 10MB</span></div>
          <div class="profile-avatar-preview"><UserAvatar :name="form.nickname || username" :avatar-url="previews.avatar" :size="96" /></div>
          <input ref="avatarInput" type="file" hidden accept="image/*" @change="event => selectFile(event, 'AVATAR')" />
          <button type="button" class="secondary-button full-button" :disabled="uploading !== ''" @click="avatarInput?.click()"><upload-outlined />{{ uploading === 'AVATAR' ? '上传中…' : '上传新头像' }}</button>
          <button v-if="previews.avatar || form.avatarAttachmentId" type="button" class="image-remove-button" @click="removeImage('AVATAR')">移除头像</button>
        </section>
        <section class="panel profile-image-card">
          <div class="member-section-heading"><h2>个人主页封面</h2><span>建议横图</span></div>
          <div class="profile-cover-preview"><img v-if="previews.cover" :src="previews.cover" alt="封面预览" /><picture-outlined v-else /></div>
          <input ref="coverInput" type="file" hidden accept="image/*" @change="event => selectFile(event, 'PROFILE_COVER')" />
          <button type="button" class="secondary-button full-button" :disabled="uploading !== ''" @click="coverInput?.click()"><upload-outlined />{{ uploading === 'PROFILE_COVER' ? '上传中…' : '上传新封面' }}</button>
          <button v-if="previews.cover || form.coverAttachmentId" type="button" class="image-remove-button" @click="removeImage('PROFILE_COVER')">移除封面</button>
        </section>
      </aside>
    </form>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { CheckOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { fetchProfile, updateProfile, uploadAttachment, type ProfileInput } from '@/api/forum'
import { refreshCurrentUser } from '@/auth'

const form = reactive<ProfileInput>({ nickname: '', bio: '', location: '', website: '' })
const previews = reactive({ avatar: '', cover: '' })
const avatarInput = ref<HTMLInputElement>()
const coverInput = ref<HTMLInputElement>()
const loading = ref(true)
const saving = ref(false)
const uploading = ref<'' | 'AVATAR' | 'PROFILE_COVER'>('')
const loadError = ref('')
const error = ref('')
const message = ref('')
const username = ref('')
const localUrls = { avatar: '', cover: '' }

onMounted(load)
onBeforeUnmount(() => {
  if (localUrls.avatar) URL.revokeObjectURL(localUrls.avatar)
  if (localUrls.cover) URL.revokeObjectURL(localUrls.cover)
})

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const profile = await fetchProfile()
    username.value = profile.username
    Object.assign(form, {
      nickname: profile.nickname || '', bio: profile.bio || '', location: profile.location || '', website: profile.website || '',
      avatarAttachmentId: profile.avatarAttachmentId, coverAttachmentId: profile.coverAttachmentId
    })
    previews.avatar = profile.avatarUrl || ''
    previews.cover = profile.coverUrl || ''
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : '资料加载失败'
  } finally {
    loading.value = false
  }
}

function setPreview(kind: 'AVATAR' | 'PROFILE_COVER', url: string) {
  const key = kind === 'AVATAR' ? 'avatar' : 'cover'
  if (localUrls[key]) URL.revokeObjectURL(localUrls[key])
  localUrls[key] = url.startsWith('blob:') ? url : ''
  previews[key] = url
}

async function selectFile(event: Event, kind: 'AVATAR' | 'PROFILE_COVER') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  message.value = ''
  if (!file.type.startsWith('image/')) {
    error.value = '头像和封面只能上传图片'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = '图片不能超过 10MB'
    return
  }
  uploading.value = kind
  setPreview(kind, URL.createObjectURL(file))
  try {
    const uploaded = await uploadAttachment(file, kind)
    if (kind === 'AVATAR') form.avatarAttachmentId = uploaded.id
    else form.coverAttachmentId = uploaded.id
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '图片上传失败'
  } finally {
    uploading.value = ''
  }
}

function removeImage(kind: 'AVATAR' | 'PROFILE_COVER') {
  setPreview(kind, '')
  if (kind === 'AVATAR') form.avatarAttachmentId = null
  else form.coverAttachmentId = null
}

async function save() {
  saving.value = true
  error.value = ''
  message.value = ''
  try {
    const profile = await updateProfile({
      nickname: form.nickname.trim(), bio: form.bio.trim(), location: form.location.trim(), website: form.website.trim(),
      avatarAttachmentId: form.avatarAttachmentId, coverAttachmentId: form.coverAttachmentId
    })
    setPreview('AVATAR', profile.avatarUrl || '')
    setPreview('PROFILE_COVER', profile.coverUrl || '')
    await refreshCurrentUser()
    message.value = '个人资料已保存'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '资料保存失败'
  } finally {
    saving.value = false
  }
}
</script>
