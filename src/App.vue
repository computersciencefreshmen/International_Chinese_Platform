<script setup></script>

<template>
  <div
    class="flex flex-col gap-2 p-8 sm:flex-row sm:items-center sm:gap-6 sm:py-4"
  >
    <img
      class="mx-auto block h-24 rounded-full sm:mx-0 sm:shrink-0"
      src="@/assets/login-bg.jpg"
      alt=""
    />
    <div class="space-y-2 text-center sm:text-left">
      <div class="space-y-0.5">
        <p class="text-lg font-semibold text-black">Erin Landform</p>
        <p class="font-medium text-gray-500">Product Engineer</p>
      </div>
      <button
        @click="console.log('Message')"
        class="border-purple-600 text-purple-600 hover:border-transparent hover:bg-purple-600 hover:text-white active:bg-purple-700"
      >
        Message111
      </button>
    </div>
  </div>
  <div class="mx-auto flex max-w-sm items-center gap-x-4 rounded-xl bg-white p-6 shadow-lg outline outline-black/5 dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
   <img class="size-12 shrink-0 w-11" src="@/assets/login-bg.jpg" alt="ChitChat Logo" />
    <div>
      <div class="text-xl font-medium text-black dark:text-white">ChitChat</div>
      <p class="text-gray-500 dark:text-gray-400">You have a new message!</p>
    </div>
  </div>
  <button class="disabled:bg-sky-500 hover:bg-sky-500">111</button>
</template>

<style scoped></style>
