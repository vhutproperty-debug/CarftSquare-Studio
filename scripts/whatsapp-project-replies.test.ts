/**
 * WhatsApp inbox project tags and the read-only replies API.
 * Run: yarn test:wa-project-replies
 */
import assert from 'node:assert/strict';
import type { Db } from 'mongodb';
import { NextRequest } from 'next/server';
import { authorizeWhatsAppReplies } from '../lib/ops/whatsapp/replies-auth';
import { listWaConversations, getWaConversationMetrics } from '../lib/whatsapp-cloud/conversation-query';
import { upsertWaMessage } from '../lib/whatsapp-cloud/message-store';
import {
  projectForTemplate,
  templateNameFromOutbound,
  templateProjectMap,
} from '../lib/whatsapp-cloud/project-map';
import { syncConversationProjects } from '../lib/whatsapp-cloud/project-tag';
import { listInboxProjects, listWhatsAppReplies, parseRepliesSince } from '../lib/whatsapp-cloud/replies';
import { isOpsTokenReadPath, middleware } from '../middleware.js';
import { createMemoryDb } from './lib/memory-db';

const ADMIN_AUTH_ERROR = 'Admin authentication required.';

function request(path: string, init?: { method?: string; headers?: Record<string, string> }) {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), init);
}

function conversation(id: string, phone: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    provider: 'whatsapp_cloud',
    providerCustomerId: `91${phone}`,
    customerWaE164: `91${phone}`,
    normalizedPhone: phone,
    businessWaNumber: 'line-1',
    matchStatus: 'unmatched',
    primaryLink: null,
    candidateLinks: [],
    lastMessageAt: '2026-11-20T12:00:00.000Z',
    lastInboundAt: null,
    lastOutboundAt: '2026-11-20T09:00:00.000Z',
    unreadCount: 1,
    keepMe: 'yes',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    ...extra,
  };
}

function message(partial: Record<string, unknown>) {
  return {
    id: String(partial.id),
    providerMessageId: String(partial.providerMessageId || partial.id),
    providerCustomerId: null,
    messageType: 'template',
    media: null,
    status: 'sent',
    statusTimestamps: { sentAt: partial.createdAt },
    failure: null,
    callbackData: null,
    normalizedPhone: '9876543210',
    businessWaNumber: 'line-1',
    rawMessage: { id: String(partial.providerMessageId || partial.id) },
    rawEventType: 'ops_send',
    ...partial,
  };
}

async function main() {
  const previousProjects = process.env.WA_TEMPLATE_PROJECTS;
  const previousToken = process.env.OPS_API_TOKEN;
  delete process.env.WA_TEMPLATE_PROJECTS;

  try {
    assert.equal(projectForTemplate('cs_transcon_nri_rent_v1'), 'Transcon Triumph');
    assert.equal(projectForTemplate('cs_transcon_owner_rent_v1'), 'Transcon Triumph');
    assert.equal(projectForTemplate('CS_TRANSCON_NRI_RENT_V1'), 'Transcon Triumph');
    assert.equal(projectForTemplate('lead_welcome'), null);
    assert.equal(projectForTemplate(''), null);
    assert.equal(templateNameFromOutbound({
      direction: 'outbound',
      bodyText: 'Template:cs_transcon_nri_rent_v1',
    }), 'cs_transcon_nri_rent_v1');
    assert.equal(templateNameFromOutbound({
      direction: 'outbound',
      bodyText: 'Campaign template:cs_transcon_owner_rent_v1',
    }), 'cs_transcon_owner_rent_v1');
    assert.equal(templateNameFromOutbound({
      direction: 'outbound',
      bodyText: 'Follow-up template:cs_transcon_nri_rent_v1',
    }), 'cs_transcon_nri_rent_v1');
    assert.equal(templateNameFromOutbound({
      direction: 'inbound',
      bodyText: 'Template:cs_transcon_nri_rent_v1',
    }), null);
    assert.equal(templateNameFromOutbound({
      direction: 'outbound',
      bodyText: 'Hello there',
    }), null);
    process.env.WA_TEMPLATE_PROJECTS = 'not-json';
    assert.equal(projectForTemplate('cs_transcon_nri_rent_v1'), 'Transcon Triumph');
    assert.equal(templateProjectMap().cs_72west_owner_outreach, undefined);
    process.env.WA_TEMPLATE_PROJECTS = JSON.stringify({
      cs_72west_owner_outreach: '72 West',
      cs_34park_owner_rent_v1: '34 Park',
    });
    assert.equal(projectForTemplate('cs_72west_owner_outreach'), '72 West');
    assert.equal(projectForTemplate('cs_34park_owner_rent_v1'), '34 Park');
    assert.equal(projectForTemplate('cs_transcon_owner_rent_v1'), 'Transcon Triumph');
    delete process.env.WA_TEMPLATE_PROJECTS;

    assert.deepEqual(parseRepliesSince(null), { since: null });
    assert.deepEqual(parseRepliesSince('2026-11-20'), { since: '2026-11-20T00:00:00.000Z' });
    assert.equal('error' in parseRepliesSince('yesterday'), true);

    const db = createMemoryDb() as unknown as Db;
    const col = db.collection('wa_conversations');
    const messages = db.collection('wa_messages');
    await col.insertOne(conversation('asha', '9876543210', {
      primaryLink: {
        entityType: 'ops_prospect',
        entityId: 'p-asha',
        matchField: 'phone',
        confidence: 'exact',
        label: 'Asha Mehta',
        personKey: 'prospect:p-asha',
      },
      lastInboundAt: '2026-11-20T12:00:00.000Z',
    }));
    await messages.insertMany([
      message({
        id: 'asha-early',
        conversationId: 'asha',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'ignore me',
        createdAt: '2026-11-18T08:00:00.000Z',
      }),
      message({
        id: 'asha-old',
        conversationId: 'asha',
        direction: 'outbound',
        bodyText: 'Follow-up template:cs_transcon_nri_rent_v1',
        createdAt: '2026-11-19T09:00:00.000Z',
      }),
      message({
        id: 'asha-new',
        conversationId: 'asha',
        direction: 'outbound',
        bodyText: 'Campaign template:cs_transcon_owner_rent_v1',
        createdAt: '2026-11-20T09:00:00.000Z',
      }),
      message({
        id: 'asha-reply',
        conversationId: 'asha',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'Interested in the 3BHK',
        createdAt: '2026-11-20T12:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('rohit', '9811111111', { lastInboundAt: '2026-11-21T11:00:00.000Z' }));
    await messages.insertMany([
      message({
        id: 'rohit-tpl',
        conversationId: 'rohit',
        direction: 'outbound',
        bodyText: 'Template:cs_transcon_nri_rent_v1',
        normalizedPhone: '9811111111',
        createdAt: '2026-11-21T09:00:00.000Z',
      }),
      message({
        id: 'rohit-first',
        conversationId: 'rohit',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'Yes please',
        normalizedPhone: '9811111111',
        createdAt: '2026-11-21T10:00:00.000Z',
      }),
      message({
        id: 'rohit-stop',
        conversationId: 'rohit',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'STOP',
        normalizedPhone: '9811111111',
        createdAt: '2026-11-21T11:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('nina', '9820504417', { lastInboundAt: '2026-11-22T10:00:00.000Z' }));
    await messages.insertMany([
      message({
        id: 'nina-tpl',
        conversationId: 'nina',
        direction: 'outbound',
        bodyText: 'Template:cs_transcon_owner_rent_v1',
        normalizedPhone: '9820504417',
        createdAt: '2026-11-22T09:00:00.000Z',
      }),
      message({
        id: 'nina-stop',
        conversationId: 'nina',
        direction: 'inbound',
        messageType: 'button',
        bodyText: 'Stop messages',
        normalizedPhone: '9820504417',
        createdAt: '2026-11-22T10:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('early', '9833333333', { lastInboundAt: '2026-11-10T10:00:00.000Z' }));
    await messages.insertMany([
      message({
        id: 'early-in',
        conversationId: 'early',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'before the template',
        normalizedPhone: '9833333333',
        createdAt: '2026-11-10T10:00:00.000Z',
      }),
      message({
        id: 'early-tpl',
        conversationId: 'early',
        direction: 'outbound',
        bodyText: 'Template:cs_transcon_nri_rent_v1',
        normalizedPhone: '9833333333',
        createdAt: '2026-11-20T09:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('hidden-thread', '9844444444', {
      hidden: true,
      lastInboundAt: '2026-11-20T15:00:00.000Z',
    }));
    await messages.insertMany([
      message({
        id: 'hidden-tpl',
        conversationId: 'hidden-thread',
        direction: 'outbound',
        bodyText: 'Template:cs_transcon_nri_rent_v1',
        createdAt: '2026-11-20T09:00:00.000Z',
      }),
      message({
        id: 'hidden-in',
        conversationId: 'hidden-thread',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'secret',
        createdAt: '2026-11-20T15:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('unmapped', '9855555555', { lastInboundAt: '2026-11-23T10:00:00.000Z' }));
    await messages.insertMany([
      message({
        id: 'unmapped-old',
        conversationId: 'unmapped',
        direction: 'outbound',
        bodyText: 'Template:cs_transcon_nri_rent_v1',
        createdAt: '2026-11-22T09:00:00.000Z',
      }),
      message({
        id: 'unmapped-new',
        conversationId: 'unmapped',
        direction: 'outbound',
        bodyText: 'Template:lead_welcome',
        createdAt: '2026-11-23T09:00:00.000Z',
      }),
      message({
        id: 'unmapped-in',
        conversationId: 'unmapped',
        direction: 'inbound',
        messageType: 'text',
        bodyText: 'hi',
        createdAt: '2026-11-23T10:00:00.000Z',
      }),
    ]);

    await col.insertOne(conversation('plain', '9866666666'));
    await db.collection('do_not_delete').insertOne({ id: 'sentinel', name: 'keep' });
    await db.collection('contacts').insertOne({
      id: 'c-rohit',
      name: 'Rohit Sharma',
      phones: ['+919811111111'],
    });
    await db.collection('contacts').insertOne({
      id: 'c-asha',
      name: 'Wrong Name',
      phones: ['+919876543210'],
    });
    await db.collection('ops_prospects').insertOne({
      id: 'p-nina',
      name: 'Nina Kapoor',
      phone: '9820504417',
    });

    const beforeMessages = (await messages.find({}).toArray()).length;
    const updated = await syncConversationProjects(db);
    assert.equal(updated, 7);
    assert.equal((await messages.find({}).toArray()).length, beforeMessages);
    assert.equal((await db.collection('do_not_delete').find({}).toArray()).length, 1);

    const asha = await col.findOne({ id: 'asha' });
    assert.equal(asha?.project, 'Transcon Triumph');
    assert.equal(asha?.projectTemplate, 'cs_transcon_owner_rent_v1');
    assert.equal(asha?.repliedAfterTemplate, true);
    assert.equal(asha?.keepMe, 'yes');
    assert.equal(asha?.matchStatus, 'unmatched');
    assert.equal(asha?.unreadCount, 1);

    const unmapped = await col.findOne({ id: 'unmapped' });
    assert.equal(unmapped?.project, null);
    assert.equal(unmapped?.projectTemplate, 'lead_welcome');
    assert.equal(unmapped?.repliedAfterTemplate, true);
    assert.equal(unmapped?.keepMe, 'yes');

    const early = await col.findOne({ id: 'early' });
    assert.equal(early?.project, 'Transcon Triumph');
    assert.equal(early?.repliedAfterTemplate, false);

    const plain = await col.findOne({ id: 'plain' });
    assert.equal(plain?.project, undefined);
    assert.equal(plain?.keepMe, 'yes');
    assert.ok(plain?.projectInferredAt);

    const second = await syncConversationProjects(db);
    assert.equal(second, 0);
    assert.equal((await col.findOne({ id: 'asha' }))?.project, 'Transcon Triumph');
    assert.equal((await messages.find({}).toArray()).length, beforeMessages);

    const repliedThreads = await listWaConversations(db, { repliedOnly: true });
    const repliedIds = repliedThreads.map((row) => row.id).sort();
    assert.deepEqual(repliedIds, ['asha', 'nina', 'rohit', 'unmapped']);
    const transcon = await listWaConversations(db, { project: 'Transcon Triumph' });
    assert.deepEqual(transcon.map((row) => row.id).sort(), ['asha', 'early', 'nina', 'rohit']);
    const both = await listWaConversations(db, { project: 'Transcon Triumph', repliedOnly: true });
    assert.deepEqual(both.map((row) => row.id).sort(), ['asha', 'nina', 'rohit']);
    const metrics = await getWaConversationMetrics(db);
    assert.equal(metrics.replied, repliedThreads.length);
    const projects = await listInboxProjects(db);
    assert.ok(projects.includes('Transcon Triumph'));
    assert.equal(projects.includes(''), false);

    const replies = await listWhatsAppReplies(db);
    const ashaReply = replies.find((row) => row.phone === '+919876543210');
    assert.ok(ashaReply);
    assert.equal(ashaReply?.contactName, 'Asha Mehta');
    assert.equal(ashaReply?.project, 'Transcon Triumph');
    assert.equal(ashaReply?.template, 'cs_transcon_owner_rent_v1');
    assert.equal(ashaReply?.replyText, 'Interested in the 3BHK');
    assert.equal(ashaReply?.replyAt, '2026-11-20T12:00:00.000Z');
    assert.equal(ashaReply?.optOut, false);

    const rohitReply = replies.find((row) => row.phone === '+919811111111');
    assert.equal(rohitReply?.contactName, 'Rohit Sharma');
    assert.equal(rohitReply?.replyText, 'Yes please');
    assert.equal(rohitReply?.optOut, false);

    const ninaReply = replies.find((row) => row.phone === '+919820504417');
    assert.equal(ninaReply?.contactName, 'Nina Kapoor');
    assert.equal(ninaReply?.replyText, 'Stop messages');
    assert.equal(ninaReply?.optOut, true);
    assert.equal(replies.some((row) => row.replyText === 'secret'), false);
    assert.equal(replies.some((row) => row.replyText === 'before the template'), false);
    assert.equal(replies.some((row) => row.replyText === 'hi'), false);

    const since = await listWhatsAppReplies(db, { since: '2026-11-22T00:00:00.000Z' });
    assert.deepEqual(since.map((row) => row.replyText), ['Stop messages']);
    const byProject = await listWhatsAppReplies(db, { project: 'Transcon Triumph' });
    assert.equal(byProject.every((row) => row.project === 'Transcon Triumph'), true);
    assert.equal(byProject.length, 3);
    const none = await listWhatsAppReplies(db, { project: '34 Park' });
    assert.equal(none.length, 0);

    await col.insertOne(conversation('live', '9000000001', {
      unreadCount: 2,
      matchStatus: 'matched',
    }));
    await upsertWaMessage(db, {
      conversationId: 'live',
      providerMessageId: 'wamid.live.1',
      providerCustomerId: null,
      direction: 'outbound',
      messageType: 'template',
      bodyText: 'Template:cs_transcon_nri_rent_v1',
      status: 'sent',
      statusTimestamps: { sentAt: new Date().toISOString() },
      failure: null,
      callbackData: null,
      normalizedPhone: '9000000001',
      businessWaNumber: 'line-1',
      rawMessage: { id: 'wamid.live.1', message: 'Template:cs_transcon_nri_rent_v1' },
      rawEventType: 'ops_send',
    });
    assert.equal((await col.findOne({ id: 'live' }))?.project, 'Transcon Triumph');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await upsertWaMessage(db, {
      conversationId: 'live',
      providerMessageId: 'wamid.live.2',
      providerCustomerId: null,
      direction: 'outbound',
      messageType: 'template',
      bodyText: 'Template:lead_welcome',
      status: 'sent',
      statusTimestamps: { sentAt: new Date().toISOString() },
      failure: null,
      callbackData: null,
      normalizedPhone: '9000000001',
      businessWaNumber: 'line-1',
      rawMessage: { id: 'wamid.live.2', message: 'Template:lead_welcome' },
      rawEventType: 'ops_send',
    });
    assert.equal((await col.findOne({ id: 'live' }))?.project, null);
    assert.equal((await col.findOne({ id: 'live' }))?.projectTemplate, 'lead_welcome');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await upsertWaMessage(db, {
      conversationId: 'live',
      providerMessageId: 'wamid.live.3',
      providerCustomerId: null,
      direction: 'outbound',
      messageType: 'template',
      bodyText: 'Template:cs_transcon_owner_rent_v1',
      status: 'sent',
      statusTimestamps: { sentAt: new Date().toISOString() },
      failure: null,
      callbackData: null,
      normalizedPhone: '9000000001',
      businessWaNumber: 'line-1',
      rawMessage: { id: 'wamid.live.3', message: 'Template:cs_transcon_owner_rent_v1' },
      rawEventType: 'ops_send',
    });
    await upsertWaMessage(db, {
      conversationId: 'live',
      providerMessageId: 'wamid.live.2',
      providerCustomerId: null,
      direction: 'outbound',
      messageType: 'status',
      bodyText: null,
      status: 'delivered',
      statusTimestamps: { deliveredAt: new Date().toISOString() },
      failure: null,
      callbackData: null,
      normalizedPhone: '9000000001',
      businessWaNumber: 'line-1',
      rawMessage: { id: 'wamid.live.2', message_status: 'delivered' },
      rawEventType: 'message_api_delivered',
    });
    const live = await col.findOne({ id: 'live' });
    assert.equal(live?.project, 'Transcon Triumph');
    assert.equal(live?.projectTemplate, 'cs_transcon_owner_rent_v1');
    assert.equal(live?.keepMe, 'yes');
    assert.equal(live?.unreadCount, 2);
    assert.equal(live?.matchStatus, 'matched');
    assert.equal((await messages.find({ conversationId: 'live' }).toArray()).length, 3);

    const envDb = createMemoryDb() as unknown as Db;
    await envDb.collection('wa_conversations').insertOne(conversation('west', '9876500000'));
    await envDb.collection('wa_messages').insertOne(message({
      id: 'west-tpl',
      conversationId: 'west',
      direction: 'outbound',
      bodyText: 'Template:cs_72west_owner_outreach',
      normalizedPhone: '9876500000',
      createdAt: '2026-11-20T09:00:00.000Z',
    }));
    await envDb.collection('wa_messages').insertOne(message({
      id: 'park-note',
      conversationId: 'west',
      direction: 'inbound',
      messageType: 'text',
      bodyText: 'Send details',
      normalizedPhone: '9876500000',
      createdAt: '2026-11-18T09:00:00.000Z',
    }));
    await syncConversationProjects(envDb);
    assert.equal((await envDb.collection('wa_conversations').findOne({ id: 'west' }))?.project, null);
    process.env.WA_TEMPLATE_PROJECTS = JSON.stringify({
      cs_72west_owner_outreach: '72 West',
      cs_34park_owner_rent_v1: '34 Park',
    });
    await syncConversationProjects(envDb);
    const west = await envDb.collection('wa_conversations').findOne({ id: 'west' });
    assert.equal(west?.project, '72 West');
    assert.equal(west?.projectTemplate, 'cs_72west_owner_outreach');
    assert.equal(west?.repliedAfterTemplate, false);
    assert.equal(west?.keepMe, 'yes');
    assert.equal((await envDb.collection('wa_messages').find({}).toArray()).length, 2);
    const named = await listInboxProjects(envDb);
    assert.ok(named.includes('72 West'));
    assert.ok(named.includes('34 Park'));
    assert.ok(named.includes('Transcon Triumph'));

    assert.equal(isOpsTokenReadPath('/api/ops/whatsapp/replies', 'GET'), true);
    assert.equal(isOpsTokenReadPath('/api/ops/whatsapp/replies/', 'GET'), true);
    assert.equal(isOpsTokenReadPath('/api/ops/whatsapp/replies', 'POST'), false);
    assert.equal(isOpsTokenReadPath('/api/ops/whatsapp/replies/extra', 'GET'), false);
    assert.equal(isOpsTokenReadPath('/api/ops/whatsapp/conversations', 'GET'), false);

    const open = await middleware(request('/api/ops/whatsapp/replies', {
      method: 'GET',
      headers: { authorization: 'Bearer replies-test-token' },
    }));
    assert.notEqual(open.status, 401);
    assert.equal(open.headers.get('x-middleware-next'), '1');
    const slashed = await middleware(request('/api/ops/whatsapp/replies/', { method: 'GET' }));
    assert.equal(slashed.headers.get('x-middleware-next'), '1');
    const posted = await middleware(request('/api/ops/whatsapp/replies', { method: 'POST' }));
    assert.equal(posted.status, 401);
    assert.equal((await posted.json()).error, ADMIN_AUTH_ERROR);
    const inbox = await middleware(request('/api/ops/whatsapp/conversations'));
    assert.equal(inbox.status, 401);
    assert.equal((await inbox.json()).error, ADMIN_AUTH_ERROR);
    const near = await middleware(request('/api/ops/whatsapp/replies/extra'));
    assert.equal(near.status, 401);

    process.env.OPS_API_TOKEN = 'replies-test-token';
    const allowed = authorizeWhatsAppReplies(new Request('https://craftsquare.co.in/api/ops/whatsapp/replies', {
      headers: { authorization: 'Bearer replies-test-token' },
    }));
    assert.equal(allowed, null);
    const wrong = authorizeWhatsAppReplies(new Request('https://craftsquare.co.in/api/ops/whatsapp/replies', {
      headers: { authorization: 'Bearer x' },
    }));
    assert.equal(wrong?.status, 401);
    const missing = authorizeWhatsAppReplies(new Request('https://craftsquare.co.in/api/ops/whatsapp/replies'));
    assert.equal((await missing?.json())?.error, 'OPS API token is required.');
    delete process.env.OPS_API_TOKEN;
    const unconfigured = authorizeWhatsAppReplies(new Request('https://craftsquare.co.in/api/ops/whatsapp/replies', {
      headers: { authorization: 'Bearer replies-test-token' },
    }));
    assert.equal((await unconfigured?.json())?.error, 'OPS API token is not configured.');

    console.log('whatsapp-project-replies: ok');
  } finally {
    if (previousProjects === undefined) delete process.env.WA_TEMPLATE_PROJECTS;
    else process.env.WA_TEMPLATE_PROJECTS = previousProjects;
    if (previousToken === undefined) delete process.env.OPS_API_TOKEN;
    else process.env.OPS_API_TOKEN = previousToken;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
