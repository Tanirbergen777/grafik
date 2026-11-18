import { createRouter, createWebHistory } from 'vue-router'
import UsersList from '../views/OneC/UsersList.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/onec'
    },
    {
      path: '/onec',
      name: 'onec-users',
      component: UsersList
    }
  ]
})

export default router
