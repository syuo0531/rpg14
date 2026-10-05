/* STUDY FORGE FC - PHASE 16
 * Rival schools, direct set pieces, awakened-player presentation.
 */
(function(global){
  'use strict';

  function create(api){
    const state=()=>api.getState();
    const soccer=()=>state().soccer;
    const rt=()=>api.getRuntime();
    const clamp=(v,a,b)=>api.clamp(Number(v)||0,a,b);

    function ensure(){
      const s=soccer();
      s.phase16=(s.phase16&&typeof s.phase16==='object')?s.phase16:{};
      s.phase16.rivals=(s.phase16.rivals&&typeof s.phase16.rivals==='object')?s.phase16.rivals:{};
      return s.phase16;
    }
    function rivalKey(opponent){
      return String(opponent?.teamId||opponent?.name||'unknown').replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠_-]/g,'_').slice(0,80);
    }
    function rivalEntry(opponent){
      const p=ensure(),key=rivalKey(opponent);
      if(!p.rivals[key])p.rivals[key]={key,name:opponent?.name||'強豪校',meetings:0,w:0,d:0,l:0,gf:0,ga:0,heat:0,rival:false,lastResult:'',lastYear:0};
      return p.rivals[key];
    }
    function eventIsMajor(event){
      return ['interhigh','championship','promotion'].includes(event?.type);
    }
    function rivalInfo(opponent){
      const e=rivalEntry(opponent);
      return {...e,label:e.rival?'RIVAL':'HISTORY',record:e.meetings?e.w+'勝 '+e.d+'分 '+e.l+'敗':'初対戦'};
    }
    function onMatchStart(opponent,event){
      const r=rt();if(!r)return;
      ensure();
      const e=rivalEntry(opponent);
      r.phase16={rivalKey:e.key,nextSetPiece:18+Math.floor(Math.random()*15),setPieces:0};
      if(e.rival)api.cinematic?.('RIVAL MATCH',soccer().schoolName+' vs '+e.name,'legendary','因縁の再戦',950);
    }
    function finishMatch({opponent,event,home,away,won,draw}){
      const e=rivalEntry(opponent),close=Math.abs(home-away)<=1;
      e.meetings++;e.gf+=home;e.ga+=away;e.lastYear=soccer().year||1;
      if(won){e.w++;e.lastResult='WIN';}
      else if(draw){e.d++;e.lastResult='DRAW';}
      else{e.l++;e.lastResult='LOSE';}
      e.heat=clamp((e.heat||0)+16+(close?10:0)+(eventIsMajor(event)?18:0)+(!won&&!draw&&eventIsMajor(event)?14:0),0,100);
      const became=!e.rival&&(e.meetings>=2||e.heat>=45);
      if(became){
        e.rival=true;
        api.cinematic?.('NEW RIVAL',e.name,'legendary','因縁の相手として記録',1100);
        api.showMoment?.('RIVAL BORN',e.name,'legendary');
      }
      return {entry:e,became};
    }
    function renderRival(opponent){
      const box=api.dom('soccerRivalBanner');if(!box)return;
      const e=rivalEntry(opponent);
      const visible=e.meetings>0||e.rival;
      box.classList.toggle('hidden',!visible);
      box.classList.toggle('is-rival',!!e.rival);
      if(!visible)return;
      box.innerHTML='<span>'+(e.rival?'🔥 RIVAL MATCH':'対戦履歴')+'</span><b>'+api.escapeHtml(e.name)+'</b><small>'+e.meetings+'戦 • '+e.w+'勝 '+e.d+'分 '+e.l+'敗 • HEAT '+e.heat+'</small>';
    }

    function livePlayers(){
      const r=rt(),lineup=api.matchLineup();
      const ids=Object.values(lineup||{});
      return ids.map(id=>soccer().players.find(p=>p.id===id)).filter(Boolean);
    }
    function setPieceTaker(type){
      const list=livePlayers().filter(p=>p.primaryPos!=='GK');
      const score=p=>type==='ck'
        ?api.matchAttr(p,'PAS')*1.25+api.matchAttr(p,'DRI')*.25
        :api.matchAttr(p,'SHO')*1.15+api.matchAttr(p,'PAS')*.38;
      return list.sort((a,b)=>score(b)-score(a))[0]||livePlayers()[0]||null;
    }
    function setPieceType(){
      const n=Math.random();
      return n<.13?'pk':n<.48?'fk':'ck';
    }
    function tryStartSetPiece(){
      const r=rt();if(!r||r.finished||r.inChance)return false;
      r.phase16=r.phase16||{nextSetPiece:22,setPieces:0};
      if(r.minute<(r.phase16.nextSetPiece||22)||(r.phase16.setPieces||0)>=2||r.minute>=88)return false;
      const type=setPieceType(),taker=setPieceTaker(type);if(!taker)return false;
      r.inChance=true;r.chanceType='setpiece';r.actionLocked=false;r.setPiece={type,takerId:taker.id,mark:['left','center','right'][Math.floor(Math.random()*3)]};
      r.phase16.setPieces=(r.phase16.setPieces||0)+1;
      r.phase16.nextSetPiece=r.minute+30+Math.floor(Math.random()*15);
      const label=type==='pk'?'PENALTY':type==='fk'?'FREE KICK':'CORNER KICK';
      api.log?.(label+'! '+taker.name+' がキッカー');
      api.cinematic?.(label,taker.name,'good','SET PIECE',650);
      api.renderMatch?.();
      return true;
    }
    function isSetPieceHealthy(){
      const r=rt();
      return !!(r?.inChance&&r.chanceType==='setpiece'&&r.setPiece&&api.dom('soccerSetPieceControls')&&!api.dom('soccerSetPieceControls').classList.contains('hidden'));
    }
    function renderSetPiece(){
      const r=rt(),sp=r?.setPiece;if(!r?.inChance||r.chanceType!=='setpiece'||!sp)return;
      const taker=soccer().players.find(p=>p.id===sp.takerId);if(!taker)return;
      const type=sp.type;
      let actors='',help='',labels=[];
      if(type==='pk'){
        actors=api.athleteMarkup({p:taker,x:50,y:35,team:'home',focus:true})+api.athleteMarkup({x:50,y:9,team:'opponent',pos:'GK',number:1,name:'GK',actorId:'def-gk',extraClass:'keeper'})+'<span class="phase16-static-ball pk"></span>';
        help='<b>PENALTY • '+api.escapeHtml(taker.name)+'</b><span>コースを選択。GKも同時に読みます。</span>';
        labels=['左へ蹴る','中央へ蹴る','右へ蹴る'];
      }else if(type==='fk'){
        actors=api.athleteMarkup({p:taker,x:50,y:45,team:'home',focus:true})+
          [42,47,52,57].map((x,i)=>api.athleteMarkup({x,y:24,team:'opponent',pos:'DF',number:i+3,name:'壁',actorId:'wall-'+i})).join('')+
          api.athleteMarkup({x:50,y:8,team:'opponent',pos:'GK',number:1,name:'GK',actorId:'def-gk',extraClass:'keeper'})+'<span class="phase16-static-ball fk"></span>';
        help='<b>FREE KICK • '+api.escapeHtml(taker.name)+'</b><span>壁とGKの位置を見て狙うコースを選択。</span>';
        labels=['左上を狙う','壁の上・中央','右上を狙う'];
      }else{
        actors=api.athleteMarkup({p:taker,x:10,y:14,team:'home',focus:true})+
          api.athleteMarkup({x:42,y:22,team:'home',pos:'CF',number:9,name:'味方',actorId:'ck-near'})+
          api.athleteMarkup({x:52,y:18,team:'home',pos:'CB',number:4,name:'味方',actorId:'ck-center'})+
          api.athleteMarkup({x:64,y:25,team:'home',pos:'FW',number:11,name:'味方',actorId:'ck-far'})+
          [38,48,58,68].map((x,i)=>api.athleteMarkup({x,y:23+(i%2)*4,team:'opponent',pos:'DF',number:i+2,name:'相手',actorId:'ck-def-'+i})).join('')+
          api.athleteMarkup({x:50,y:8,team:'opponent',pos:'GK',number:1,name:'GK',actorId:'def-gk',extraClass:'keeper'})+'<span class="phase16-static-ball ck"></span>';
        help='<b>CORNER KICK • '+api.escapeHtml(taker.name)+'</b><span>クロスを入れるゾーンを選択。</span>';
        labels=['ニア','中央','ファー'];
      }
      api.dom('soccerPitchActors').className='match-live phase16-setpiece-live';
      api.dom('soccerPitchActors').innerHTML=actors;
      api.dom('soccerChanceHelp').className='soccer-chance-overlay is-chance phase16-setpiece-help';
      api.dom('soccerChanceHelp').innerHTML=help;
      const panel=api.dom('soccerSetPieceControls');
      panel?.querySelectorAll('[data-setpiece-target]').forEach((b,i)=>{b.textContent=labels[i]||b.textContent;b.disabled=!!r.actionLocked;});
    }
    function finishSetPiece(goal=false){
      const r=rt();if(!r)return;
      r.inChance=false;r.chanceType=null;r.actionLocked=false;r.setPiece=null;
      r.nextChance=Math.max(Number(r.nextChance)||0,r.minute+5);
      r.nextDefense=Math.max(Number(r.nextDefense)||0,r.minute+5);
      api.renderMatch?.();
    }
    async function resolveSetPiece(target){
      const r=rt(),sp=r?.setPiece;if(!r?.inChance||r.chanceType!=='setpiece'||r.actionLocked||!sp)return;
      const taker=soccer().players.find(p=>p.id===sp.takerId);if(!taker)return;
      r.actionLocked=true;renderSetPiece();
      const lanes=['left','center','right'],lane=lanes.includes(target)?target:'center';
      let chance=0,scorer=taker,assistId=null,from={x:50,y:40},to={x:lane==='left'?38:lane==='right'?62:50,y:4};
      if(sp.type==='pk'){
        chance=.53+api.matchAttr(taker,'SHO')/235-r.opponent.strength/820;
        if(lane===sp.mark)chance*=.42;
        chance=clamp(chance,.28,.88);from={x:50,y:35};
      }else if(sp.type==='fk'){
        chance=.11+api.matchAttr(taker,'SHO')/210+api.matchAttr(taker,'PAS')/900-r.opponent.strength/720;
        if(lane===sp.mark)chance*=.58;if(lane==='center')chance*=.88;
        chance=clamp(chance,.12,.68);from={x:50,y:45};
      }else{
        const receivers=livePlayers().filter(p=>p.id!==taker.id&&p.primaryPos!=='GK').sort((a,b)=>(api.matchAttr(b,'PHY')+api.matchAttr(b,'SHO'))-(api.matchAttr(a,'PHY')+api.matchAttr(a,'SHO')));
        scorer=receivers[lane==='center'?0:lane==='left'?1:2]||receivers[0]||taker;assistId=taker.id;
        chance=.055+api.matchAttr(taker,'PAS')/520+api.matchAttr(scorer,'PHY')/900+api.matchAttr(scorer,'SHO')/1050-r.opponent.strength/1050;
        if(lane===sp.mark)chance*=.62;
        chance=clamp(chance,.08,.48);from={x:10,y:14};to={x:lane==='left'?42:lane==='right'?64:52,y:14};
      }
      try{await api.animateBall?.(from,to,{shot:sp.type!=='ck'});}catch(_){}
      const goal=Math.random()<chance;
      if(goal){
        r.home++;r.userGoals++;api.registerGoal?.(scorer.id,assistId);api.onGoal?.(scorer);
        api.log?.((sp.type==='ck'?scorer.name+' ヘディング':' '+taker.name)+' SET PIECE GOAL!');
        api.screenImpact?.(true);api.cinematic?.('GOAL!',scorer.name+' • '+r.minute+"'",'good',sp.type==='pk'?'PENALTY':sp.type==='fk'?'FREE KICK':'CORNER',950);
        api.showMoment?.('SET PIECE GOAL',scorer.name,'good');
      }else{
        api.log?.((sp.type==='pk'?'PK':sp.type==='fk'?'FK':'CK')+'は相手に阻まれた');
        api.showMoment?.(sp.type==='pk'?'SAVED':'CLEARED','SET PIECE','bad');
      }
      setTimeout(()=>finishSetPiece(goal),260);
    }

    return {ensure,rivalInfo,onMatchStart,finishMatch,renderRival,tryStartSetPiece,isSetPieceHealthy,renderSetPiece,resolveSetPiece};
  }
  global.StudyForgePhase16={create};
})(window);
