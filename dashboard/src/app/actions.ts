'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isAuthed, login, logout, setSelectedGuild } from '@/lib/auth';

function assertAuthed() {
  if (!isAuthed()) throw new Error('Unauthorized');
}

export async function doLogin(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  if (login(password)) redirect('/');
  redirect('/login?error=1');
}

export async function doLogout() {
  logout();
  redirect('/login');
}

export async function selectGuild(formData: FormData) {
  assertAuthed();
  const guildId = String(formData.get('guildId') ?? '');
  if (guildId) setSelectedGuild(guildId);
  revalidatePath('/', 'layout');
}

export async function toggleModule(formData: FormData) {
  assertAuthed();
  const guildId = String(formData.get('guildId'));
  const moduleKey = String(formData.get('module'));
  const enabled = String(formData.get('enabled')) === 'true';
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.guildModule.upsert({
    where: { guildId_module: { guildId, module: moduleKey } },
    create: { guildId, module: moduleKey, enabled },
    update: { enabled },
  });
  revalidatePath('/modules');
  revalidatePath(`/modules/${moduleKey}`);
}

export async function setConfigValue(formData: FormData) {
  assertAuthed();
  const guildId = String(formData.get('guildId'));
  const namespace = String(formData.get('namespace'));
  const key = String(formData.get('key'));
  const raw = String(formData.get('value') ?? '');

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = raw;
  }
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.guildConfig.upsert({
    where: { guildId_namespace_key: { guildId, namespace, key } },
    create: { guildId, namespace, key, value: value as never },
    update: { value: value as never },
  });
  revalidatePath(`/modules/${namespace}`);
  revalidatePath('/config');
}

export async function resetConfigValue(formData: FormData) {
  assertAuthed();
  const guildId = String(formData.get('guildId'));
  const namespace = String(formData.get('namespace'));
  const key = String(formData.get('key'));
  await prisma.guildConfig
    .delete({ where: { guildId_namespace_key: { guildId, namespace, key } } })
    .catch(() => undefined);
  revalidatePath(`/modules/${namespace}`);
  revalidatePath('/config');
}

export async function addPermission(formData: FormData) {
  assertAuthed();
  const guildId = String(formData.get('guildId'));
  const node = String(formData.get('node'));
  const targetType = String(formData.get('targetType')) === 'USER' ? 'USER' : 'ROLE';
  const targetId = String(formData.get('targetId'));
  const effect = String(formData.get('effect')) === 'DENY' ? 'DENY' : 'ALLOW';
  if (!node || !targetId) return;
  await prisma.guild.upsert({ where: { id: guildId }, create: { id: guildId }, update: {} });
  await prisma.permissionAssignment.upsert({
    where: { guildId_node_targetType_targetId: { guildId, node, targetType, targetId } },
    create: { guildId, node, targetType, targetId, effect },
    update: { effect },
  });
  revalidatePath('/permissions');
}

export async function removePermission(formData: FormData) {
  assertAuthed();
  const id = String(formData.get('id'));
  await prisma.permissionAssignment.delete({ where: { id } }).catch(() => undefined);
  revalidatePath('/permissions');
}

export async function setMaintenance(formData: FormData) {
  assertAuthed();
  const on = String(formData.get('maintenance')) === 'true';
  const note = String(formData.get('note') ?? '');
  await prisma.globalState.upsert({
    where: { id: 1 },
    create: { id: 1, maintenance: on, maintenanceNote: note || null },
    update: { maintenance: on, maintenanceNote: note || null },
  });
  revalidatePath('/');
}
