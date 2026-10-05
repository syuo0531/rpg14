/* STUDY FORGE FC - PHASE 14
 * High-impact game feel: ZONE, awakenings, special abilities, scout hype and match rewards.
 */
(function(global){
  'use strict';

  const ABILITIES={
    ace_dribbler:{name:'ACE DRIBBLER',desc:'ドリブル成功率UP',actions:{dribble:.055}},
    killer_pass:{name:'KILLER PASS',desc:'パス成功率UP',actions:{pass:.05}},
    clutch:{name:'CLUTCH',desc:'決定機のシュート成功率UP',actions:{shoot:.055}},
    ball_hunter:{name:'BALL HUNTER',desc:'守備成功率UP',actions:{defense:.055}},
    big_game:{name:'BIG GAME',desc:'試合中の全アクションを強化',actions:{dribble:.018,pass:.018,shoot:.018,defense:.018}},
    wonderkid:{name:'WONDERKID',desc:'若手の爆発力',actions:{dribble:.025,pass:.025,shoot:.025}}
  };
  const CHESTS=[
    {key:'BRONZE',label:'BRONZE BOX',min:0,tp:4,sp:1,fp:2},
    {key:'SILVER',label:'SILVER BOX',min:28,tp:7,sp:2,fp:4},
    {key:'GOLD',label:'GOLD BOX',min:50,tp:11,sp:4,fp:7},
    {key:'ELITE',label:'ELITE BOX',min:72,tp:17,sp:6,fp:11},
    {key:'LEGEND',label:'LEGEND BOX',min:91,tp:25,sp:10,fp:16}
  ];

  function create(api){
    const state=()=>api.getSoccerState();
    const runtime=()=>api.getMatchRuntime();
    const clamp=(v,a,b)=>api.clamp(Number(v)||0,a,b);

    function ensureRoot(){
      const s=state();
      s.phase14=(s.phase14&&typeof s.phase14==='object')?s.phase14:{};
      s.phase14.totalAwakenings=Math.max(0,Number(s.phase14.totalAwakenings)||0);
      s.phase14.legendBoxes=Math.max(0,Number(s.phase14.legendBoxes)||0);
      s.phase14.lastReward=s.phase14.lastReward||null;
      return s.phase14;
    }
    function ensurePlayer(p){
      if(!p)return null;
      p.phase14Abilities=Array.isArray(p.phase14Abilities)?[...new Set(p.phase14Abilities.filter(x=>ABILITIES[x]))]:[];
      p.awakenLevel=Math.max(0,Number(p.awakenLevel)||0);
      p.phase14Impact=Math.max(0,Number(p.phase14Impact)||0);
      return p;
    }
    function ensureRuntime(rt=runtime()){
      if(!rt)return null;
      rt.phase14=(rt.phase14&&typeof rt.phase14==='object')?rt.phase14:{};
      const z=rt.phase14;
      z.flow=clamp(z.flow,0,100);
      z.zoneActive=!!z.zoneActive;
      z.zoneUntil=Math.max(0,Number(z.zoneUntil)||0);
      z.zoneCount=Math.max(0,Number(z.zoneCount)||0);
      return z;
    }
    function abilityNames(p){
      ensurePlayer(p);
      return p.phase14Abilities.map(id=>ABILITIES[id]?.name).filter(Boolean);
    }
    function abilityBonus(p,action){
      ensurePlayer(p);
      return p.phase14Abilities.reduce((sum,id)=>sum+(ABILITIES[id]?.actions?.[action]||0),0);
    }
    function zoneActive(){
      const rt=runtime(),z=ensureRuntime(rt);
      return !!(rt&&z?.zoneActive&&rt.minute<z.zoneUntil);
    }
    function zoneBonus(action){
      if(!zoneActive())return 0;
      return action==='defense'?.04:.05;
    }
    function actionBoost(p,action){
      return clamp(abilityBonus(p,action)+zoneBonus(action),0,.11);
    }
    function teamMultiplier(){
      return zoneActive()?1.065:1;
    }
    function announceZone(on){
      if(on){
        api.showMoment?.('ZONE ACTIVATED','FLOW MAX • 15 MIN','legendary');
        api.cinematic?.('ZONE','TEAM OVERDRIVE','legendary','SUCCESS RATE UP',900);
      }else api.showMoment?.('ZONE END','FLOW RESET','good');
    }
    function addFlow(amount){
      const rt=runtime(),z=ensureRuntime(rt);if(!rt||rt.finished||!z)return;
      if(z.zoneActive){
        z.zoneUntil=Math.min(90,Math.max(z.zoneUntil,rt.minute+3));
        renderHud();return;
      }
      z.flow=clamp(z.flow+(Number(amount)||0),0,100);
      if(z.flow>=100){
        z.flow=0;z.zoneActive=true;z.zoneUntil=Math.min(90,rt.minute+15);z.zoneCount++;
        announceZone(true);
      }
      renderHud();
    }
    function onActionSuccess(p,action){
      if(!p)return;ensurePlayer(p);
      const gains={pass:12,dribble:18,shoot:28,goal:36,defense:17};
      const impact={pass:1,dribble:2,shoot:2,goal:6,defense:2.5};
      p.phase14Impact+=(impact[action]||1);
      addFlow(gains[action]||10);
    }
    function onGoal(p){onActionSuccess(p,'goal');}
    function onTick(){
      const rt=runtime(),z=ensureRuntime(rt);if(!rt||!z)return;
      if(z.zoneActive&&rt.minute>=z.zoneUntil){z.zoneActive=false;z.flow=25;announceZone(false);}
      renderHud();
    }
    function onMatchStart(){
      ensureRoot();
      state().players.forEach(p=>{ensurePlayer(p);p.phase14Impact=0;});
      const rt=runtime();if(rt)rt.phase14={flow:0,zoneActive:false,zoneUntil:0,zoneCount:0};
      renderHud();
    }
    function renderHud(){
      const pitch=api.dom?.('soccerPitch');if(!pitch)return;
      let el=api.dom?.('phase14ZoneHud');
      if(!el){
        el=document.createElement('div');el.id='phase14ZoneHud';el.className='phase14-zone-hud';
        el.innerHTML='<div class="phase14-zone-head"><span>FLOW</span><b id="phase14ZoneText">0%</b></div><div class="phase14-zone-bar"><i id="phase14ZoneBar"></i></div><small id="phase14ZoneSub">成功プレーでZONEへ</small>';
        pitch.appendChild(el);
      }
      const rt=runtime(),z=ensureRuntime(rt),active=!!(rt&&z?.zoneActive&&rt.minute<z.zoneUntil),flow=z?.flow||0;
      el.classList.toggle('active',active);
      const txt=api.dom?.('phase14ZoneText'),bar=api.dom?.('phase14ZoneBar'),sub=api.dom?.('phase14ZoneSub');
      if(txt)txt.textContent=active?'ZONE':Math.round(flow)+'%';
      if(bar)bar.style.width=(active?100:flow)+'%';
      if(sub)sub.textContent=active?'成功率UP • '+Math.max(0,z.zoneUntil-(rt?.minute||0))+'分':'成功プレーでZONEへ';
    }
    function pickAbility(p){
      ensurePlayer(p);
      const pos=p.primaryPos||'';
      let pool=['big_game'];
      if(['LWG','RWG','LMF','RMF'].includes(pos))pool.push('ace_dribbler','killer_pass');
      if(['CF','OMF'].includes(pos))pool.push('clutch','ace_dribbler','killer_pass');
      if(['CMF','DMF'].includes(pos))pool.push('killer_pass','ball_hunter');
      if(['CB','LSB','RSB','GK'].includes(pos))pool.push('ball_hunter');
      if(Number(p.grade)===1)pool.push('wonderkid');
      pool=[...new Set(pool)].filter(id=>!p.phase14Abilities.includes(id));
      return pool.length?pool[Math.floor(Math.random()*pool.length)]:null;
    }
    function awakenCandidate({won,event,opponentOvr,teamOvr}){
      const rt=runtime();if(!rt)return null;
      const participants=state().players.filter(p=>(rt.minutesPlayed?.[p.id]||0)>=30).map(p=>{
        ensurePlayer(p);
        const goals=rt.playerGoals?.[p.id]||0,assists=rt.playerAssists?.[p.id]||0;
        const score=(p.phase14Impact||0)+goals*9+assists*5+(Number(p.grade)===1?2:0);
        return {p,goals,assists,score};
      }).sort((a,b)=>b.score-a.score);
      if(!participants.length)return null;
      const top=participants.slice(0,Math.min(4,participants.length));
      const weighted=top[Math.floor(Math.random()*Math.min(top.length,2))]||top[0];
      const underdog=won&&Number(opponentOvr)>Number(teamOvr)+4;
      const national=['interhigh','championship'].includes(event?.type);
      const chance=clamp(.018+weighted.goals*.035+weighted.assists*.018+weighted.score*.0025+(underdog?.035:0)+(national?.018:0)+(Number(weighted.p.grade)===1?.012:0),.018,.22);
      if(Math.random()>=chance)return null;
      const p=weighted.p,attrs=['PAC','SHO','PAS','DRI','DEF','PHY'];
      const preferred={GK:['DEF','PHY','PAS'],CB:['DEF','PHY','PAC'],LSB:['PAC','DEF','PAS'],RSB:['PAC','DEF','PAS'],DMF:['DEF','PAS','PHY'],CMF:['PAS','DRI','PHY'],OMF:['PAS','DRI','SHO'],LMF:['PAC','DRI','PAS'],RMF:['PAC','DRI','PAS'],LWG:['PAC','DRI','SHO'],RWG:['PAC','DRI','SHO'],CF:['SHO','PAC','PHY']}[p.primaryPos]||attrs;
      const shuffled=[...preferred].sort(()=>Math.random()-.5).slice(0,2),gains=[];
      shuffled.forEach(a=>{const gain=Math.random()<.22?2:1;p[a]=clamp((Number(p[a])||40)+gain,25,99);gains.push(a+' +'+gain);});
      p.potential=clamp((Number(p.potential)||70)+(Math.random()<.35?2:1),50,99);p.awakenLevel++;p.ovr=api.playerOvr?.(p)||p.ovr;
      let ability=null;
      if(!p.phase14Abilities.length||Math.random()<.65){ability=pickAbility(p);if(ability)p.phase14Abilities.push(ability);}
      ensureRoot().totalAwakenings++;
      return {player:p,gains,ability,abilityName:ability?ABILITIES[ability].name:null,level:p.awakenLevel};
    }
    function rewardChest({won,draw,event,opponentOvr,teamOvr}){
      const s=state(),underdog=won&&Number(opponentOvr)>Number(teamOvr)+5,national=['interhigh','championship'].includes(event?.type);
      let roll=Math.random()*56+(won?25:draw?10:0)+(underdog?13:0)+(national?9:0);
      if(event?.type==='promotion'&&won)roll+=8;
      const chest=CHESTS.slice().reverse().find(x=>roll>=x.min)||CHESTS[0];
      s.trainingPoints=(Number(s.trainingPoints)||0)+chest.tp;
      if(s.scouting)s.scouting.points=(Number(s.scouting.points)||0)+chest.sp;
      if(s.facilities)s.facilities.points=(Number(s.facilities.points)||0)+chest.fp;
      const root=ensureRoot();if(chest.key==='LEGEND')root.legendBoxes++;
      root.lastReward={key:chest.key,label:chest.label,tp:chest.tp,sp:chest.sp,fp:chest.fp,at:Date.now()};
      return {...chest};
    }
    function finishMatch(ctx){
      ensureRoot();
      const chest=rewardChest(ctx),awakening=awakenCandidate(ctx);
      if(chest.key==='LEGEND')api.cinematic?.('LEGEND BOX','ULTRA RARE REWARD','legendary','MATCH DROP',1050);
      else if(['ELITE','GOLD'].includes(chest.key))api.showMoment?.(chest.label,'MATCH REWARD',chest.key==='ELITE'?'legendary':'good');
      if(awakening)setTimeout(()=>api.cinematic?.('BREAKTHROUGH',awakening.player.name,'legendary','覚醒 LV.'+awakening.level,1100),180);
      return {chest,awakening};
    }
    function onScoutSearch(candidates=[]){
      const best=[...candidates].sort((a,b)=>(b.stars||0)-(a.stars||0)||(a.nationalRank||999)-(b.nationalRank||999))[0];
      if(!best)return;
      if((best.stars||0)>=5)api.cinematic?.('5★ PROSPECT',best.name,'legendary','MONSTER FOUND',1050);
      else if((best.stars||0)>=4)api.showMoment?.('ELITE PROSPECT',best.name,'legendary');
    }

    return {ABILITIES,ensureRoot,ensurePlayer,ensureRuntime,abilityNames,actionBoost,teamMultiplier,onActionSuccess,onGoal,onTick,onMatchStart,renderHud,finishMatch,onScoutSearch,zoneActive};
  }

  global.StudyForgePhase14={create,ABILITIES};
})(window);
