import yaml
R=lambda n:{'$ref':f'#/components/schemas/{n}'}
P=lambda n:{'$ref':f'#/components/parameters/{n}'}
RS=lambda n:{'$ref':f'#/components/responses/{n}'}
def s(t,**k): d={'type':t}; d.update(k); return d
STR=s('string'); DATE=s('string',format='date'); TS=s('string',format='date-time')
def tbd(dp,desc,base=None):
    d=dict(base or STR); d['description']=f'TBD ({dp}): {desc}'; d['x-tbd']=dp; return d
def dec(dp,desc,base=None):
    d=dict(base or STR); d['description']=f'{desc} (Decided {dp}, 2026-10-13; see dp-proposals.md)'; d['x-decision']=dp; return d
FT=lambda desc='': s('string',description=(desc+' ' if desc else '')+'Free text: screened by the controlled-data gate (BR-44). Max 32 KB (DP-04).',maxLength=32768,**{'x-free-text':True})
def enum(*v): return s('string',enum=list(v))
ro=lambda x:{**x,'readOnly':True}

schemas={
 'Problem':s('object',description='RFC 9457 problem+json. `code` is stable and machine-readable.',required=['type','title','status','code'],properties={
   'type':s('string',format='uri'),'title':STR,'status':s('integer'),'detail':STR,'instance':STR,
   'code':enum('validation_failed','gate:attestation_required','gate:controlled_marker','not_found','version_conflict','precondition_required','stage_conflict','sod_violation','idempotency_conflict','forbidden_origin','rate_limited','internal'),
   'fields':s('array',items=s('object',properties={'name':STR,'message':STR})),
   'markerId':dec('DP-03','Matched marker id (K<n>/R<n>) is returned and shown in the 422 message. Matched text is never returned or logged')}),
 'Meta':s('object',properties={
   'id':ro(dec('DP-01','System ID <TYPE>-YYYY-NNNN (SQ/CAL: NNN), year in workspace TZ, per-type per-year sequence, immutable; soft-deleted records keep their ID reserved')),
   'version':ro(s('integer',description='Optimistic-concurrency counter, returned as ETag "W/\\"<version>\\""')),
   'createdAt':ro(TS),'updatedAt':ro(TS),
   'deletedAt':ro({**TS,'description':'Soft delete (BRD §13.1). Removed items are excluded from lists, counts and pickers.'}),
   'isSample':s('boolean',description='BR-31: true for the illustrative seed set (labelled "ILLUSTRATIVE — SAMPLE RECORDS"). Allowed in every env. Client-settable on create only (immutable after). dev/stage: required true on create, else 422 non_sample_data_forbidden (BR-45, QA-34). prod: an isSample=true create from the client is ignored and stored as false; only the seed loader sets it.'),
   'draft':ro(s('object',description='Reserved AI seam (BRD §12 #1). Always null in this build.',nullable=True)),
   'aiAssisted':ro(s('boolean',const=False))}),
 'WriteCommon':s('object',required=['actorName'],properties={
   'actorName':s('string',description='Self-asserted actor/reviewer name (BR-11). No identity yet (ADR-0008). 1–100 chars, trimmed, letters/space/.,\'- (DP-04).',minLength=1,maxLength=100),
   'controlledDataAttestation':s('boolean',description='Required true on every request that persists free text (BR-44). Missing/false → 400 gate:attestation_required. Required only on endpoints that accept a free-text field (DP-03).')}),
 'Page':s('object',required=['items'],properties={'items':s('array',items={}),'nextCursor':s('string',nullable=True,description='Opaque; pass as ?cursor=. Absent on the last page.')}),
 'AuditEvent':s('object',properties={'eventId':ro(STR),'at':ro(TS),'actorName':ro(STR),'eventType':ro(enum('CREATED','UPDATED','STAGE_CHANGED','DELETED','RESTORED','SIGNED','COMPLETED','COMPLETION_UNDONE','RELEASED','SUPERSEDED','REVIEWER_DECISION','AI_DRAFT_ACCEPTED','AI_DRAFT_MODIFIED','AI_DRAFT_REJECTED')),
   'fromStage':ro(STR),'toStage':ro(STR),'controlledDataAttested':ro(s('boolean')),'snapshot':ro(s('object')),
   },description='Append-only (BR-08, BR-46). AI_DRAFT_* are reserved and never emitted in this build.'),
 'Transition':s('object',allOf=[R('WriteCommon')],required=['fromStage','toStage'],properties={'fromStage':STR,'toStage':STR,'comment':FT('Optional note.')},description='Generic stage advance; writes STAGE_CHANGED (BR-36). Conditional on current stage = fromStage (409 stage_conflict). Forward one stage at a time, no skip; only backward move is QM Review → Investigation with a required comment; Closed is terminal; QM Review → Closed only by a reviewer independent of the author (DP-02, DP-08).'),
 'QualityRecord':s('object',allOf=[R('Meta'),R('WriteCommon')],required=['type','title','severity'],properties={
   'type':enum('CAPA','NCMR','SCAR'),'title':FT('Short title.'),'description':FT('Event description.'),
   'severity':enum('Critical','Major','Minor'),
   'stage':ro(enum('New','Containment','Investigation','Draft Ready','QM Review','Closed')),
   'clause':s('string',description='Standard/clause reference'),'dueDate':DATE,'needByDate':{**DATE,'description':'Need-by date (BR-15, delivery details optional)'},
   'deliveryDetails':FT('Optional.'),'reviewerName':s('string',description='BR-11'),
   'disposition':enum('Use as is','Rework','Repair','Scrap','Return to supplier'),
   'independentApprover':s('string',description='Required for Use as is / Repair (BR-10). Independent = different from the author after trim/whitespace-collapse/case-fold; hard block 409 sod_violation (DP-08).'),
   'sourceRecordId':s('string',description='e.g. NCMR that raised a SCAR (OQ-23)'),
   'stepFields':dec('DP-02','CAPA/NCMR step 2–6 fields per the approved step specs',s('object'))}),
 'Supplier':s('object',allOf=[R('Meta'),R('WriteCommon')],description='Supplier master record with create/edit (DP-10).',properties={
   'name':STR,'commodity':STR,'criticality':enum('Critical','Standard'),
   'onTimePct':dec('DP-10','Entered manually',s('number',minimum=0,maximum=100)),'openScarCount':ro(dec('DP-10','Derived from SCAR records linked by supplierId',s('integer'))),
   'certRenewalDate':DATE,'standards':s('array',items=enum('AMS 2750','AS6174','AS9100D','AS9102','NADCAP','NAS 410')),
   'score':ro(s('number',description='0–100 from BR-47 weights (PLACEHOLDER values, DP-16)')),'band':ro(STR),
   'flags':ro(dec('DP-10','Derived: open SCAR/CAPA linked → flag; next step text by band',s('array',items=STR)))}),
 'SupplierQualification':s('object',allOf=[R('Meta'),R('WriteCommon')],required=['supplierName'],properties={
   'supplierName':s('string',description='Required to continue (BR-17)'),'scopeRequested':FT(),'approvedScope':FT(),
   'stage':ro(enum('Request','Docs & certs','Risk','Evaluation','Approval','Active on ASL')),
   'docsReviewNotes':FT('Step 2 documentation & certification review.'),
   'approverName':s('string',description='Required to approve & add to ASL (BR-35, BR-38)'),'approvalDate':DATE,
   'reevalDate':{**DATE,'description':'Must be after approvalDate, else 422 (DP-19)'},'reviewerName':STR,
   'stepFields':dec('DP-02','SQ step 3/4/6 fields per the approved step specs; forward-only',s('object'))}),
 'PoFinding':s('object',properties={'rowId':ro(STR),'requirement':FT(),'clause':enum('AS9100D §8.4.3','AS9102'),'status':enum('Missing','Weak','Present','Not captured'),'suggestedWording':FT(),'whyCitation':FT('"Why this citation" note.')}),
 'PoCheck':s('object',allOf=[R('Meta'),R('WriteCommon')],description='Manual entry, observed fields only (BRD §13.2). Field classes per DP-04.',properties={
   'poNumber':STR,'supplier':STR,'part':STR,'quantity':STR,'revision':FT('Observed as free text.'),
   'findings':s('array',items=R('PoFinding')),
   'summaryCounts':ro(s('object',description='Derived count per status',additionalProperties=s('integer')))}),
 'Fai':s('object',allOf=[R('Meta'),R('WriteCommon')],required=['partNumber','partName'],properties={
   'partNumber':s('string',description='Required (BR-22)'),'partName':s('string',description='Required (BR-22)'),
   'partRevision':s('string',description='N/A if blank'),'faiReportNumber':ro(dec('DP-01','Auto FAIR-YYYY-NNNN')),
   'partType':enum('Detail','Sub-Assembly','Assembly','COTS','Software'),'faiType':enum('Full','Partial','Delta'),
   'reason':FT('Reason for FAI.'),'routingNumber':STR,'status':ro(STR),
   'preparerSignature':ro(s('object',properties={'name':STR,'at':TS})),'evaluatorSignature':ro(s('object',properties={'name':STR,'at':TS})),
   'form2':tbd('OQ-08','Form 2 not observed.',s('object'))}),
 'FaiSignature':s('object',allOf=[R('WriteCommon')],required=['role'],properties={'role':enum('preparer','evaluator')},description='BR-33: evaluator ≠ preparer, preparer signs first (409 sod_violation). Names compared after trim/whitespace-collapse/case-fold (DP-08). Preparer may un-sign (audited) only before the evaluator signs; after both sign, no edits (DP-09).'),
 'FaiCharacteristic':s('object',allOf=[R('Meta'),R('WriteCommon')],properties={'charNo':s('integer'),'refLocation':STR,'designator':s('string',default='None'),'requirement':FT(),'result':FT(),'equipment':STR,'passFail':s('string',enum=['PASS','FAIL'],default='PASS'),'ncrDisposition':FT(),'checks':ro(s('array',items=STR,description='Advisory completeness checks (BR-34)'))}),
 'Calibration':s('object',allOf=[R('Meta'),R('WriteCommon')],required=['equipmentName'],properties={
   'equipmentName':s('string',description='Required (BR-23)'),'equipmentId':s('string',description='Blank → auto ID (BR-39, format DP-01; uniqueness DP-01)'),
   'type':enum('Caliper','Micrometer','Gauge','Height gauge','CMM','Torque wrench','Surface plate','Test equipment','Other'),
   'certificateRef':STR,'lastCalibrationDate':DATE,'nextDueDate':{**DATE,'description':'+6/+12/+24 months helper; clamps to last day of month (DP-12)'},
   'calibratedBy':STR,'nistStatement':FT('NIST traceability statement.'),
   'status':ro(enum('Active','Due soon','Overdue'))}),
 'Training':s('object',allOf=[R('Meta'),R('WriteCommon')],properties={'role':STR,'person':STR,'course':STR,'sourceRecordId':STR,'standardOrSop':STR,'dueDate':DATE,
   'completedDate':ro(DATE),'status':ro(enum('Current','Due soon','Overdue','Not started')),
   'recurrence':dec('DP-07','Per-course recurrence in months (none = one-off); next due = completion + interval; Not started until start-by passes, then Overdue',s('object'))}),
 'Document':s('object',allOf=[R('Meta'),R('WriteCommon')],required=['name'],properties={
   'name':s('string',description='Required (BR-26)'),'documentNumber':STR,'revision':STR,
   'type':enum('Work Instruction','Procedure','Drawing','Quality Manual section','Form','Specification','Other'),
   'location':FT('Link or description (BR-07, references only).'),'effectiveDate':DATE,'nextReviewDate':DATE,
   'status':s('string',enum=['Draft','Under review','Released','Superseded'],description='Superseded is set by the server only (BR-37). Number and revision immutable; new revision = new record; releasing a revision ≤ current → 409; mixed numeric/alpha revision → 422 (DP-11).'),
   'approvedBy':s('string',description='Required when Released (BR-37, BR-38)')}),
 'ApprovalRole':s('object',allOf=[R('Meta'),R('WriteCommon')],description='Convenience only, not access control (BR-19).',properties={'roleName':STR,'people':s('array',items=STR),'defaultFor':s('array',items=enum('Supplier Qualification','CAPA','NCMR','Document','FAI','Purchase Order'))}),
 'QmsAssessment':s('object',allOf=[R('Meta'),R('WriteCommon')],properties={'ratings':s('array',minItems=8,maxItems=8,items=s('integer',minimum=1,maximum=5,nullable=True)),
   'overallScore':ro(s('number',description='Mean of 8 ratings (BR-41); rounded half-up to 1 decimal; no score until 8/8 answered (DP-06)')),'band':ro(dec('DP-06','Initial / Developing / Defined / Managed / Optimising by floor of score',s('string',enum=['Initial','Developing','Defined','Managed','Optimising']))),'topGaps':ro(s('array',items=STR))}),
 'Config':s('object',description='BR-47 values from SSM. **PLACEHOLDER** defaults until Vishwas tunes them (DP-16). The controlled-data marker list is never exposed.',properties={
   'status':ro(s('string',const='PLACEHOLDER')),'supplierRisk':ro(s('object')),'dueSoonDays':ro(s('object')),'timezone':ro(dec('DP-12','Workspace timezone, America/New_York',s('string',const='America/New_York')))}),
}
params={
 'Id':{'name':'id','in':'path','required':True,'schema':STR},
 'Cursor':{'name':'cursor','in':'query','schema':STR,'description':'Opaque cursor from nextCursor'},
 'Limit':{'name':'limit','in':'query','schema':s('integer',minimum=1,maximum=100,default=25)},
 'IncludeDeleted':{'name':'includeDeleted','in':'query','schema':s('boolean',default=False)},
 'IdempotencyKey':{'name':'Idempotency-Key','in':'header','required':True,'schema':s('string',format='uuid'),'description':'Required on every POST. Same key + same body within 24 h returns the original response; same key + different body → 409 idempotency_conflict.'},
 'IfMatch':{'name':'If-Match','in':'header','required':True,'schema':STR,'description':'ETag from the last GET. Missing → 428 precondition_required; stale → 412 version_conflict.'},
}
def prob(st,desc): return {'description':desc,'content':{'application/problem+json':{'schema':R('Problem')}}}
resp={'BadRequest':prob(400,'Validation error or gate:attestation_required (BR-44)'),
 'Unprocessable':prob(422,'gate:controlled_marker (BR-44). Nothing persisted, no audit event. Message names the marker id; input is kept client-side only (DP-03). Also, dev/stage only: non_sample_data_forbidden (BR-45, QA-34): a create without isSample=true is rejected; nothing persisted, no audit event. Enabled by the env profile (ADR-0013); prod ignores it.'),
 'NotFound':prob(404,'Not found (or soft-deleted)'),'Conflict':prob(409,'stage_conflict, sod_violation or idempotency_conflict'),
 'PreconditionFailed':prob(412,'version_conflict'),'PreconditionRequired':prob(428,'If-Match missing'),
 'Forbidden':prob(403,'forbidden_origin: request did not come through CloudFront (ADR-0015)'),'TooMany':prob(429,'rate_limited (API Gateway throttle)')}
def ok(schema,code='200',desc='OK',etag=False):
    r={'description':desc,'content':{'application/json':{'schema':schema}}}
    if etag: r['headers']={'ETag':{'schema':STR}}
    return {code:r}
common_err={'403':RS('Forbidden'),'429':RS('TooMany')}
def page(n): return {'allOf':[R('Page'),s('object',properties={'items':s('array',items=R(n))})]}
paths={}
def collection(path,name,tag,fn='records-api',extra=None):
    paths[path]={'x-sentinelqa-function':fn,
     'get':{'tags':[tag],'operationId':f'list{name}','parameters':[P('Cursor'),P('Limit'),P('IncludeDeleted')]+(extra or []),'responses':{**ok(page(name)),**common_err}},
     'post':{'tags':[tag],'operationId':f'create{name}','parameters':[P('IdempotencyKey')],'requestBody':{'required':True,'content':{'application/json':{'schema':R(name)}}},
       'responses':{**ok(R(name),'201','Created',True),'400':RS('BadRequest'),'409':RS('Conflict'),'422':RS('Unprocessable'),**common_err}}}
    paths[path+'/{id}']={'x-sentinelqa-function':fn,'parameters':[P('Id')],
     'get':{'tags':[tag],'operationId':f'get{name}','responses':{**ok(R(name),etag=True),'404':RS('NotFound'),**common_err}},
     'patch':{'tags':[tag],'operationId':f'update{name}','parameters':[P('IfMatch')],'requestBody':{'required':True,'content':{'application/merge-patch+json':{'schema':R(name)}}},
       'responses':{**ok(R(name),etag=True),'400':RS('BadRequest'),'404':RS('NotFound'),'409':RS('Conflict'),'412':RS('PreconditionFailed'),'422':RS('Unprocessable'),'428':RS('PreconditionRequired'),**common_err}},
     'delete':{'tags':[tag],'operationId':f'delete{name}','description':'Soft delete: sets deletedAt and appends a DELETED audit event (BRD §13.1). No DynamoDB DeleteItem (denied in every env).','parameters':[P('IfMatch'),{'name':'actorName','in':'query','required':True,'schema':STR}],
       'responses':{'204':{'description':'Soft-deleted'},'404':RS('NotFound'),'412':RS('PreconditionFailed'),'428':RS('PreconditionRequired'),**common_err}}}
def action(path,opid,tag,schema,desc,fn='records-api'):
    paths[path]={'x-sentinelqa-function':fn,'parameters':[P('Id')],'post':{'tags':[tag],'operationId':opid,'description':desc,'parameters':[P('IdempotencyKey'),P('IfMatch')],
      'requestBody':{'required':True,'content':{'application/json':{'schema':schema}}},
      'responses':{**ok(s('object'),'200','OK',True),'400':RS('BadRequest'),'404':RS('NotFound'),'409':RS('Conflict'),'412':RS('PreconditionFailed'),'422':RS('Unprocessable'),**common_err}}}
q=lambda n,sc:{'name':n,'in':'query','schema':sc}
collection('/api/quality-records','QualityRecord','Quality records',extra=[q('type',enum('CAPA','NCMR','SCAR')),q('severity',STR),q('stage',STR),q('standard',STR)])
action('/api/quality-records/{id}/transitions','transitionQualityRecord','Quality records',R('Transition'),'Stage advance (BR-13). Rules per DP-02.')
collection('/api/suppliers','Supplier','Suppliers',extra=[q('standard',STR)])
collection('/api/supplier-qualifications','SupplierQualification','Supplier qualification',extra=[q('stage',STR)])
action('/api/supplier-qualifications/{id}/transitions','transitionSupplierQualification','Supplier qualification',R('Transition'),'Step advance (BR-36). To Active on ASL requires approverName (BR-35).')
collection('/api/po-checks','PoCheck','Purchase controls',extra=[q('status',STR),q('clause',STR)])
collection('/api/fai','Fai','FAI')
action('/api/fai/{id}/signatures','signFai','FAI',R('FaiSignature'),'Sign as preparer/evaluator (BR-33).')
paths['/api/fai/{id}/characteristics']={'x-sentinelqa-function':'records-api','parameters':[P('Id')],
  'get':{'tags':['FAI'],'operationId':'listFaiCharacteristics','parameters':[P('Cursor'),P('Limit')],'responses':{**ok(page('FaiCharacteristic')),**common_err}},
  'post':{'tags':['FAI'],'operationId':'createFaiCharacteristic','description':'One row per request (row + audit event in one transaction).','parameters':[P('IdempotencyKey')],'requestBody':{'required':True,'content':{'application/json':{'schema':R('FaiCharacteristic')}}},'responses':{**ok(R('FaiCharacteristic'),'201','Created',True),'400':RS('BadRequest'),'422':RS('Unprocessable'),**common_err}}}
paths['/api/fai/{id}/characteristics/{charId}']={'x-sentinelqa-function':'records-api','parameters':[P('Id'),{'name':'charId','in':'path','required':True,'schema':STR}],
  'patch':{'tags':['FAI'],'operationId':'updateFaiCharacteristic','parameters':[P('IfMatch')],'requestBody':{'required':True,'content':{'application/merge-patch+json':{'schema':R('FaiCharacteristic')}}},'responses':{**ok(R('FaiCharacteristic'),etag=True),'400':RS('BadRequest'),'412':RS('PreconditionFailed'),'422':RS('Unprocessable'),**common_err}},
  'delete':{'tags':['FAI'],'operationId':'deleteFaiCharacteristic','description':'Soft delete of a Form 3 row (US-36, §13.1).','parameters':[P('IfMatch'),{'name':'actorName','in':'query','required':True,'schema':STR}],'responses':{'204':{'description':'Soft-deleted'},'412':RS('PreconditionFailed'),**common_err}}}
collection('/api/calibration','Calibration','Calibration',extra=[q('status',enum('Active','Due soon','Overdue'))])
collection('/api/training','Training','Training')
action('/api/training/{id}/complete','completeTraining','Training',R('WriteCommon'),'Mark complete (BR-40): sets completedDate, status Current, COMPLETED event.')
action('/api/training/{id}/undo-complete','undoCompleteTraining','Training',R('WriteCommon'),'Undo (BR-40) as a reversal: COMPLETION_UNDONE event (§13.1).')
collection('/api/documents','Document','Document control',extra=[q('status',STR)])
collection('/api/approval-roles','ApprovalRole','Approval roles')
collection('/api/qms-assessments','QmsAssessment','QMS Champion')
paths['/api/audit/{entityType}/{entityId}/events']={'x-sentinelqa-function':'records-api','parameters':[
   {'name':'entityType','in':'path','required':True,'schema':enum('quality-records','suppliers','supplier-qualifications','po-checks','fai','calibration','training','documents','approval-roles','qms-assessments')},
   {'name':'entityId','in':'path','required':True,'schema':STR}],
  'get':{'tags':['Audit'],'operationId':'listAuditEvents','description':'Timeline (US-03, BR-08, BR-36), oldest first. Read-only Query on AuditLog.','parameters':[P('Cursor'),P('Limit')],'responses':{**ok(page('AuditEvent')),'404':RS('NotFound'),**common_err}}}
def rep(path,opid,desc,schema=None,extra=None):
    paths[path]={'x-sentinelqa-function':'reports-api','get':{'tags':['Reports'],'operationId':opid,'description':desc,'parameters':extra or [],'responses':{**ok(schema or s('object')),**common_err}}}
rep('/api/reports/dashboard','getDashboard','Tiles and "items need attention" count (BR-42). FAI sign-off pending = FAI with an unsigned role; Effectiveness checks due = 0, "Not tracked in this build" (DP-17). Overdue CAPA/NCMR count in Needs attention (DP-20).')
rep('/api/reports/review-queue','getReviewQueue','Awaiting your review, severity then age (BR-14). Critical > Major > Minor, then oldest openedAt first (DP-13); overdue flagged (DP-20).',page('QualityRecord'),[P('Cursor'),P('Limit')])
rep('/api/reports/threatens-delivery','getThreatensDelivery','Open CAPA/NCMR with need-by ≤ 14 days (BR-15). Calendar days in America/New_York, inclusive (DP-12).',page('QualityRecord'),[P('Cursor'),P('Limit')])
rep('/api/reports/due','getDueItems','Due-soon/overdue items per entity via GSI2 (BR-18, BR-25, training).',None,[q('entityType',enum('quality-records','supplier-qualifications','calibration','training','documents')),q('before',DATE),P('Cursor'),P('Limit')])
rep('/api/reports/trends','getTrends','Opened vs closed 12 weeks, severity mix, by standard, clause Pareto (US-12). ISO weeks in workspace TZ; Pareto marks first 80% (DP-14).')
rep('/api/reports/supplier-risk','getSupplierRisk','Suppliers ranked by ascending score (BR-16, US-18). Ties by name A–Z (DP-13).',page('Supplier'),[q('standard',STR),P('Cursor'),P('Limit')])
paths['/api/config']={'x-sentinelqa-function':'reports-api','get':{'tags':['Config'],'operationId':'getConfig','description':'Read-only BR-47 configuration. Values are changed by an operator in SSM, not via the API.','responses':{**ok(R('Config')),**common_err}}}
doc={'openapi':'3.1.0','info':{'title':'SentinelQA API','version':'0.5.0','description':
 'Source of truth for the records-api / reports-api routes (architecture v0.5, BRD v1.4). Skeleton contract: only BRD-backed fields; decided fields carry `x-decision: DP-nn` (decisions 2026-10-13, docs/requirements/dp-proposals.md); remaining open items are `x-tbd`.\n\n'
 'Conventions:\n'
 '- **Origin**: every request must carry the CloudFront-injected `X-Origin-Verify` header, checked before anything else (403 forbidden_origin, ADR-0015).\n'
 '- **Errors**: `application/problem+json` (`Problem`).\n'
 '- **Pagination**: `?limit` (1–100, default 25) + opaque `?cursor`; response `{items, nextCursor}`.\n'
 '- **Idempotency**: `Idempotency-Key` (UUID) required on every POST; 24 h dedupe record in the Domain table plus `ClientRequestToken` on TransactWriteItems.\n'
 '- **Concurrency**: `version` attribute; responses carry `ETag`; PATCH/DELETE/actions need `If-Match` (428 if missing, 412 if stale). Stage moves are additionally conditional on `fromStage` (409).\n'
 '- **Soft delete**: DELETE sets `deletedAt` and appends a DELETED audit event; lists exclude deleted unless `includeDeleted=true` (BRD §13.1).\n'
 '- **Real-data guard (BR-45, QA-34; dev/stage only)**: creates must carry `isSample=true`, else 422 `non_sample_data_forbidden`; nothing persisted. Prod ignores the flag. See `iac/ci-and-data-guards.md` §3.\n'
 '- **Controlled-data gate (BR-44)**: free-text fields (`x-free-text`) require `controlledDataAttestation=true` (else 400 `gate:attestation_required`); a marker hit (whole-word, case-insensitive, list in SSM) → 422 `gate:controlled_marker`; nothing persisted, no audit event, text never logged.\n'
 '- **Audit**: every successful write appends one AuditLog event in the same transaction (BR-08, BR-46).\n'
 '- **Sample data (BR-31)**: seed items carry `isSample=true` in every env.\n'
 '- **Not routed**: `/api/ai/*` (reserved AI seam, BRD §12 #1). No `/api/search`: ⌘K is client-side over loaded lists (US-41 decision; scope DP-15). No CSV export route: the only observed CSV (agent task log, US-39) is deferred with AI.'},
 'servers':[{'url':'/','description':'Via CloudFront only'}],
 'paths':paths,'components':{'schemas':schemas,'parameters':params,'responses':resp}}
def fix(o):
    if isinstance(o,dict):
        if o.pop('nullable',False): o['type']=[o['type'],'null']
        for v in o.values(): fix(v)
    elif isinstance(o,list):
        for v in o: fix(v)
fix(doc)
yaml.safe_dump(doc,open('openapi.yaml','w'),sort_keys=False,allow_unicode=True,width=200)
