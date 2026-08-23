"use server";
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/current-user';
import { revalidatePath } from 'next/cache';
import { Permissions, hasPermission, normalizePermissions } from '@/lib/permissions';
import { requireRoleManagement } from '@/lib/permissions.server';

function validColor(v:string){return /^#[0-9a-fA-F]{6}$/.test(v);}
function cleanName(v:string){const n=v.trim(); if(!n||n.length>100) throw new Error('Nome de cargo inválido.'); return n;}
export async function createRole(guildId:string, values?:{name?:string;color?:string;hoist?:boolean;mentionable?:boolean;permissions?:string}){
  const user=await getCurrentUser(); if(!user) throw new Error('Não autorizado');
  const ctx=await requireRoleManagement(guildId);
  const bits=normalizePermissions(values?.permissions);
  if((bits & Permissions.ADMINISTRATOR)!==0n && ctx.topPosition!==Number.MAX_SAFE_INTEGER) throw new Error('Você não pode criar um cargo com Administrador acima da sua hierarquia.');
  const max=await db.role.aggregate({where:{guildId},_max:{position:true}});
  const role=await db.role.create({data:{guildId,name:cleanName(values?.name||'Novo Cargo'),color:validColor(values?.color||'')?values!.color!:'#99aab5',hoist:Boolean(values?.hoist),mentionable:Boolean(values?.mentionable),position:(max._max.position??0)+1,permissions:bits.toString()}});
  await db.auditLog.create({data:{guildId,actorId:user.id,action:'ROLE_CREATE',targetId:role.id,metadata:{name:role.name}}});
  revalidatePath(`/channels/${guildId}`); return role;
}
export async function updateRole(roleId:string,values:{name?:string;color?:string;hoist?:boolean;mentionable?:boolean;permissions?:string;position?:number}){
  const role=await db.role.findUnique({where:{id:roleId},select:{id:true,guildId:true,name:true,color:true,hoist:true,mentionable:true,permissions:true,position:true,isDefault:true,managed:true}}); if(!role) throw new Error('Cargo não encontrado.');
  const user=await getCurrentUser(); if(!user) throw new Error('Não autorizado');
  const ctx=await requireRoleManagement(role.guildId,roleId);
  const data:any={}; if(values.name!==undefined)data.name=cleanName(values.name); if(values.color!==undefined){if(!validColor(values.color))throw new Error('Cor inválida.');data.color=values.color;} if(values.hoist!==undefined)data.hoist=values.hoist; if(values.mentionable!==undefined)data.mentionable=values.mentionable;
  if(values.permissions!==undefined){const bits=normalizePermissions(values.permissions);if(ctx.topPosition!==Number.MAX_SAFE_INTEGER && (bits & Permissions.ADMINISTRATOR)!==0n)throw new Error('Você não pode conceder Administrador.');data.permissions=bits.toString();}
  if(values.position!==undefined && ctx.topPosition!==Number.MAX_SAFE_INTEGER){const p=Math.max(1,Math.min(ctx.topPosition-1,Math.floor(values.position)));data.position=p;}
  const updated=await db.role.update({where:{id:roleId},data}); await db.auditLog.create({data:{guildId:role.guildId,actorId:user.id,action:'ROLE_UPDATE',targetId:roleId,metadata:{changes:data}}}); revalidatePath(`/channels/${role.guildId}`); return updated;
}
export async function deleteRole(roleId:string){const role=await db.role.findUnique({where:{id:roleId},select:{id:true,guildId:true,isDefault:true,managed:true}});if(!role)throw new Error('Cargo não encontrado.');if(role.isDefault||role.managed)throw new Error('Este cargo não pode ser excluído.');const user=await getCurrentUser();if(!user)throw new Error('Não autorizado');await requireRoleManagement(role.guildId,roleId);await db.role.delete({where:{id:roleId}});await db.auditLog.create({data:{guildId:role.guildId,actorId:user.id,action:'ROLE_DELETE',targetId:roleId}});revalidatePath(`/channels/${role.guildId}`);return true;}
