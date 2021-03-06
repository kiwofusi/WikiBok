/*******************************************************************************
 * DescriptionEditor用Javascript
 *******************************************************************************/
jQuery(function($) {
	var
		pid,
		rid,
		mode = 'normal',
		svg = $('#result').description({
			gravity : 0.1,
			linkDistance : 60,
			charge : -300,
			ndoeFunc : function(d) {
				return true;
			},
			noArticle : function(d) {
				return (($.wikibok.findDescriptionPage(d.name,false,false)).length < 1)
			},
			emptyFunc : function(d) {
				return (($.wikibok.findDescriptionPage(d.name,false,true)).length < 1)
			},
			textClick : textClick,
		});
	$.when(
		$.wikibok.loadDescriptionPages(),
		$.wikibok.requestCGI(
			'WikiBokJs::getDescriptionJson',
			[],
			function(dat,stat,xhr) {
				//初期リビジョン番号設定
				$.revision.setRev();
				//データの定期更新設定
				$.timer.add(function(){
					$.revision.allsync();
					$.wikibok.loadDescriptionPages();
				},false);
				return true;
			},
			function(xhr,stat,err) {
				return false;
			}
		)
	)
	.done(function(func1,func2) {
		var
			h = $.wikibok.getUrlVars('#') || $.wikibok.wfMsg('defaultFocus') || '',
			count = 0,
			descjson = func2[0];
		//ノードのクラス分けの関係で弱いクラスを先に作成
		// - 単独記事の作成
		$.each($.wikibok.allDescriptionPage(),function(d,k){
			svg.addDescription(d.replace(/ /g,'_'),{type:'desc'});
		});
		// - 記事同士のリンク
		svg.linkconvert(descjson.smwlink,{nclass:'desc',eclass:'smw'});
		// - コミット済みBOK-LINK
		svg.xmlconvert(descjson.basexml,{nclass:'bok',eclass:'bok',linkName:''});
		// - コミット前BOK-LINK
		svg.xmlconvert(descjson.userxml,{nclass:'prebok',eclass:'prebok',linkName:''});
		svg.load()
		svg.update();
		//ハッシュタグまたはデフォルト値を強調
		if(h != undefined && h != '') {
			$.Deferred(function(def) {
				if($('g[data="'+h+'"]').length > 0) {
					def.resolve();
				}
				else if( count > 5) {
					def.reject();
				}
				else {
					count++;
					setTimeout(arguments.callee.call({},def),1000);
				}
			})
			.done(function() {
				var
					time = 100,
					opt = {offset:{top:-150,left:-150}};
				//指定ノードを強調
				$.Deferred(function(def) {
					svg.actNode(h);
					WINDOW_APP.util.scrollMonitor.add(function(p) {
						if(p.status == 0) {
							WINDOW_APP.util.scrollMonitor.remove(arguments.callee);
							$.scrollTo($('g[data="'+h+'"]'),time,opt);
						}
					});
					def.resolve();
				})
				.done(function(){
					setTimeout(function() {
						$.scrollTo($('g[data="'+h+'"]'),time,opt);
					},1000);
				});
			})
			.fail(function() {
				$(window).scrollTo('50%');
			});
		}
		else {
			$(window).scrollTo('50%');
		}
	});
	$('#wikibok-search')
		//位置固定/アイコン化
		.setPosition({position : 'lb'},true)
		//検索用イベント定義
		.setSearch(svg,{
			find : '.commit',
			next : '.down',
			prev : '.up',
			list : '.list',
			text : '.text'
		});
	function AfterDescriptionUpdate(_title){
		//Description側では下記の処理は必ずいる...?
		//最新のSMWリンク情報を取得(BOK-XML情報を取得していない...)
		var
			_target = {};
		$.wikibok.requestCGI(
			'WikiBokJs::getSMWLinks',
			[_title],
			function(dat,stat,xhr) {
				//編集記事から発生しているSMW-LINKを削除
				$.each(svg.links({source:_title,type:'smw'}),function(i,d) {
					//リンクデータの削除
					svg.deleteLink(d.source,d.target,d.linkName);
					_target[d.target.name] = true;
				});
				//SMW-LINK先としてのみ指定されていた記事を削除
				$.each(dat.data,function(i,d){
					if(d.target in _target) {
						delete _target[d.target];
					}
				});
				$.each(_target,function(d) {
					svg.delDescription(d);
				});
				return (dat.res);
			},
			function(xhr,stat,err) {
			},
			false
		)
		.done(function(dat,stat,xhr) {
			//現時点で有効なSMW-LINKを追加
			for(var i=0;i<dat.data.length;i++) {
				var
					o = dat.data[i],
					//すでにある場合はそのままのクラスを使う
					s = svg.getDescription(o.source) || svg.addDescription(o.source,{type:'desc'}),
					t = svg.getDescription(o.target) || svg.addDescription(o.target,{type:'desc'});
				svg.addLink(s,t,o.type,o.linkName);
			}
			svg.update();
		})
		.fail(function(){
			svg.update();
		});
	}
	/**
	 * ノード名称部分のクリックイベント
	 *  - コンテキストメニュー呼出し
	 */
	function textClick(d) {
		var
			tmp = '<dl class="content"><dt>'+$.wikibok.wfMsg('wikibok-contextmenu','itemgroup','view')+'</dt>'
					+ '<dd class="command description-view">'+$.wikibok.wfMsg('wikibok-contextmenu','description','view')+'</dd>';
			_open = true,
			message = false,
			reps = svg.links({linkName:wgReps});
		//BOK-XMLへの修正あり/なし
		if(wgEdit) {
			tmp += '<dt class="content">'+$.wikibok.wfMsg('wikibok-contextmenu','itemgroup','edit')+'</dt>';
			switch(d.type) {
				case 'bok':
					if($.revision.getData('edit')) {
						tmp +='<dd class="command description-bokrename">'+$.wikibok.wfMsg('wikibok-contextmenu','description','rename')+'</dd>';
					}
					else {
						tmp +='<dd class="command description-add">'+$.wikibok.wfMsg('wikibok-contextmenu','bok','node-create')+'</dd>'
								+ '<dd class="command description-rename">'+$.wikibok.wfMsg('wikibok-contextmenu','description','rename')+'</dd>';
					}
					break;
				case 'prebok':
					if($.revision.getData('edit')) {
						tmp +='<dd class="command description-add">'+$.wikibok.wfMsg('wikibok-contextmenu','bok','node-create')+'</dd>'
								+ '<dd class="command description-rename">'+$.wikibok.wfMsg('wikibok-contextmenu','description','rename')+'</dd>';
					}
					else {
						tmp +='<dd class="command description-bokrename">'+$.wikibok.wfMsg('wikibok-contextmenu','description','rename')+'</dd>';
					}
					break;
				case 'desc':
				default:
					tmp = tmp
							+ '<dd class="command description-create">'+$.wikibok.wfMsg('wikibok-contextmenu','description','addnode')+'</dd>'
							+ '<dd class="command description-rename">'+$.wikibok.wfMsg('wikibok-contextmenu','description','rename')+'</dd>';
					break;
			}
			tmp += '</dl>';
		}
		switch(mode) {
			case 'addSelect':
				//追加記事選択モード
				if(d.name == pid.name) {
					message = $.wikibok.wfMsg('wikibok-description-addnode','error','parents');
				}
				else if(rid[d.name] == undefined) {
					//BOK-XMLへ追加していないもののみ許可
					if(d.type == 'desc') {
						if(reps.filter(function(e){return (e.target.name == d.name)}).length > 0) {
							message = $.wikibok.wfMsg('wikibok-description-addnode','error','represent');
						}
						else {
							rid[d.name] = d;
						}
					}
					else {
						message = $.wikibok.wfMsg('wikibok-description-addnode','error','already');
					}
				}
				else {
					message = $.wikibok.wfMsg('wikibok-description-addnode','error','already');
				}
				if(message !== false) {
					$.wikibok.timePopup(
						$.wikibok.wfMsg('wikibok-description-addnode','title')+' '+$.wikibok.wfMsg('common','error'),
						message,
						5000
					);
				}
				else {
					addSelect(pid.name);
				}
				break;
			case 'normal':
			default:
				//通常のコンテキストメニュー
				$.wikibok.exDialog(
					$.wikibok.wfMsg('wikibok-contextmenu','title'),
					tmp,
					{
						create : function() {
							var
								me = $(this);
							me.on('click','.command',function(){
								//メニュークリック時にメニューそのものを閉じる
									me.dialog('close');
								})
								.on('click','.description-view',function(a,b) {
								//記事内容表示
									$.wikibok.getDescriptionPage(pid.name)
									.done(function(dat) {
										var
											page = dat.parse,
											ptxt = $(page.text['*']),
											desc = (ptxt.html() == null) ? $('<div>'+$.wikibok.wfMsg('wikibok-description','empty')+'</div>') : ptxt;
											//リンクを別タブ(ウィンドウ)で開く
											desc.find('a').attr({target:'_blank'});
										$.wikibok.viewDescriptionDialog(pid.name,desc)
										.done(function(){
											AfterDescriptionUpdate(pid.name);
										});
									})
									.fail(function() {
										var
											_t = $.wikibok.getPageNamespace(pid.name)+':'+$.wikibok.getPageName(pid.name);
										//記事がないので直接編集画面を開く
										$.wikibok.getDescriptionEdit(_t)
										.done(function(dat) {
											var
												page = dat.query.pages,
												token = $.map(page,function(d) {return d.edittoken;}).join(),
												timestamp = $.map(page,function(d) {return d.starttimestamp;}).join();
											//編集結果をAPIで反映してから,BOK-XMLへ反映する/しない
											$.wikibok.editDescriptionDialog(_t,'',{
												title : _t,
												token : token,
												basetimestamp : timestamp,
												createonly : true,
											})
											.done(function(res) {
												if(res) {
													//SVGデータ更新
													AfterDescriptionUpdate(pid.name);
												}
											});
										});
									});
								})
								.on('click','.description-add',function(a,b) {
								//指定位置へのノード追加
									mode = 'addSelect';
									addSelect(pid.name);
								})
								.on('click','.description-create',function(a,b) {
								//単一ノード追加
									var
										eMes = false;
									if(pid.type == 'desc') {
										if(reps.filter(function(e){return (e.target.name == pid.name)}).length > 0) {
											eMes = '代表表現は追加できない';
										}
									}
									else {
										eMes = 'ノードとして追加済み';
									}
									//BOK-XMLへ追加していないもののみ許可
									if(eMes !== false) {
										$.wikibok.timePopup(
											'BOK登録'+' '+$.wikibok.wfMsg('common','error'),
											eMes,
											5000
										);
									}
									else {
										//BOK-XMLへ登録処理
										$.wikibok.requestCGI(
											'WikiBokJs::createNodeRequest',
											[pid.name],
											function(dat,stat,xhr) {return (dat.res !== false);},
											function(xhr,stat,err) {return false;}
										)
										.done(function(dat,stat,xhr) {
											//クライアントデータを更新
											svg.addDescription(pid.name,{type:'prebok'});
											svg.update();
											$.revision.setRev(dat.res);
											$(me).dialog('close');
										});
									}
								})
								.on('click','.description-rename',function(a,b) {
								//名称変更
									var
										_open = true,
										pfname = $.wikibok.getPageNamespace(pid.name)+':'+$.wikibok.getPageName(pid.name),
										dtitle = $.wikibok.wfMsg('wikibok-rename-node','title'),
										tmp = '<dl>'
												+ '<dt>'+$.wikibok.wfMsg('wikibok-rename-node','headline1')+'</dt>'
												+ '<dd class="rename_fname"></dd>'
												+ '<dt>'+$.wikibok.wfMsg('wikibok-rename-node','headline2')+'</dt>'
												+ '<dd><input type="text" class="name"/></dd>'
												+ '</dl>',
										commit_btn = {
											text : $.wikibok.wfMsg('wikibok-rename-node','button','text'),
											class: $.wikibok.wfMsg('wikibok-rename-node','button','class'),
											title: $.wikibok.wfMsg('wikibok-rename-node','button','title'),
											click: function(){
												var
													me = $(this),
													error = false,
													tname = me.find('input.name').val(),
													etitle = dtitle + ' ' +$.wikibok.wfMsg('common','error'),
													ptname = $.wikibok.getPageNamespace(tname)+':'+$.wikibok.getPageName(tname);
												if(tname == '') {
													error = $.wikibok.wfMsg('wikibok-rename-node','error','empty');
												}
												else if(ptname == pfname) {
													error = $.wikibok.wfMsg('wikibok-rename-node','error','norename');
												}
												else if(svg.allNode().filter(function(d){return d.name == tname}).length > 0) {
													error = $.wikibok.wfMsg('wikibok-rename-node','error','already');
												}
												if(error != false) {
													$.wikibok.timePopup(
														etitle,
														error,
														5000
													);
												}
												else{
													if(pid.type == 'desc') {
														$.wikibok.renamePage(pfname,ptname)
														.done(function(dat) {
															if(svg.renameNode(pid.name,tname)) {
																svg.fixclear();
																svg.update();
																me.dialog('close');
															}
														})
														.fail(function(dat) {
															$.wikibok.timePopup(
																etitle,
																dat.message,
																5000
															);
														});
													}
													else {
														$.Deferred(function(myDef) {
															return $.wikibok.requestCGI(
																	'WikiBokJs::renameNodeRequest',
																	[pid.name,tname],
																	function(dat,stat,xhr) {
																		return (dat.res !== false);
																	},
																	function(xhr,stat,err) {
																	}
																)
																.done(function(dat) {
																	$.wikibok.renamePage(pfname,ptname)
																	.done(function(dat) {
																		myDef.resolve(dat);
																	})
																	.fail(function(dat){
																		myDef.reject(dat);
																	});
																})
																.fail(function(dat){
																	myDef.reject(dat);
																}).promise();
														})
														.done(function(dat) {
															if(svg.renameNode(pid.name,tname)) {
																svg.fixclear();
																svg.update();
																$.revision.setRev(dat.act);
																me.dialog('close');
															}
														})
														.fail(function(dat) {
															$.wikibok.timePopup(
																etitle,
																dat.message,
																5000
															);
														});
													}
												}
											}
											
										},
										close_btn = {
											text : $.wikibok.wfMsg('common','button_close','text'),
											class: $.wikibok.wfMsg('common','button_close','class'),
											title: $.wikibok.wfMsg('common','button_close','title'),
											click: function(){
												$(this).dialog('close');
											}
										}
									$.wikibok.exDialog(
										dtitle,
										tmp,
										{
											focus : function() {
												var
													me = $(this).dialog('widget');
												if(_open) {
													$(this).find('dd.rename_fname').html(pid.name);
													$(this).find('input.name').val('');
													me.setInterruptKeydown([
														{class : 'name',next:commit_btn.class,prev:close_btn.class}
													]);
													_open = false;
												}
											},
											buttons : [commit_btn,close_btn]
										}
									);
								});
						},
						focus : function() {
							if(_open) {
								_open = false;
								pid = d;
								$(this).html(tmp);
							}
						},
					}
				);
				break;
		}
	}
	/**
	 * 複数記事をBOK-XMLへ一括追加
	 * @param a 親ノード名称
	 */
	function addSelect(a){
		var
			tmp = '<dl class="added_bok_nodes">'
					+ '<dt>'+$.wikibok.wfMsg('wikibok-description-addnode','headline1')+'</dt>'
					+ '<dd><span class="txt">'+a+'</span></dd>'
					+ '<dt>'+$.wikibok.wfMsg('wikibok-description-addnode','headline2')+'</dt>'
					+ '<dd class="data"></dd>'
					+ '</dl>',
			dx = $.wikibok.exDialog(
				$.wikibok.wfMsg('wikibok-description-addnode','title'),
				'',
				{
					create : function() {
						$(this).html(tmp);
					},
					open : function() {
						rid = {};
					},
					close : function() {
						mode = 'normal';
					},
					buttons : [{
						text : $.wikibok.wfMsg('wikibok-description-addnode','button','text'),
						class: $.wikibok.wfMsg('wikibok-description-addnode','button','class'),
						title: $.wikibok.wfMsg('wikibok-description-addnode','button','title'),
						click: function(){
							var
								me = this,
								_rows = $.map(rid,function(d,i) {
									return d.name;
								});
							if(_rows.length < 1) {
							//未選択エラー
								$.wikibok.timePopup(
									$.wikibok.wfMsg('wikibok-description-addnode','title')+' '+$.wikibok.wfMsg('common','error'),
									$.wikibok.wfMsg('wikibok-description-addnode','error','noselect'),
									5000
								);
							}
							else {
							//BOK-XMLと代表表現リンクの作業データを登録
								$.wikibok.requestCGI(
									'WikiBokJs::createNodeToRequest',
									[_rows,a],
									function(dat,stat,xhr) {return (dat.res !== false);},
									function(xhr,stat,err) {return false;}
								)
								.done(function(dat,stat,xhr) {
									var
										_source,
										_target;
									if(dat.res !== false) {
										//リビジョン番号(編集回数)更新
										$.revision.setRev(dat.res);
										$(me).dialog('close');
										//クライアント側データを更新
										//追加先のタイプは変更なし
										_source = svg.addDescription(a); 
										for(var i=0;i<_rows.length;i++){
											//追加対象は必ず[コミット前状態]
											_target = svg.addDescription(_rows[i],{type:'prebok'});
											//リンクを追加
											svg.addLink(_source,_target,'prebok','');
										}
										svg.update();
									}
								});
							}
						}
					},{
						text : $.wikibok.wfMsg('common','button_close','text'),
						class: $.wikibok.wfMsg('common','button_close','class'),
						title: $.wikibok.wfMsg('common','button_close','title'),
						click: function(){
							$(this).dialog('close');
						}
					}]
				},
				a
			),
			itm = $.map(rid,function(d,i) {
				return '<span class="del wikibok_icon button" title="中止"/><span data="'+d.name+'" class="txt">'+d.name+'</span>';
			}),
			itm = (itm.length < 1) ? $.wikibok.wfMsg('wikibok-description-addnode','caution') : itm.join('<br/>');
		if(wgRepsFlg) {
			$(dx).find('dd.data').html(itm);
			//追加キャンセルイベントの設定
			$(dx).find('span.del').one('click',function(e,f) {
				delete rid[$(e.target).next().attr('data')];
				addSelect(a);
			});
		}
	}
	$('#wikibok-edit')
		.on('click','.new',function(a,b) {
		//新規記事追加
			var
				_open = true,
				dtitle = $.wikibok.wfMsg('wikibok-new-element','title'),
				etitle = dtitle+' '+$.wikibok.wfMsg('common','error'),
				tmp = '<dl>'
						+ '<dt>'+$.wikibok.wfMsg('wikibok-new-element','description','headline')+'</dt>'
						+ '<dd><input type="text" class="name"/></dd>'
						+ '</dl>',
				close_btn = {
					text : $.wikibok.wfMsg('common','button_close','text'),
					title: $.wikibok.wfMsg('common','button_close','title'),
					class: $.wikibok.wfMsg('common','button_close','class'),
					click: function() {
						$(this).dialog('close');
					}
				},
				create_btn = {
					text : $.wikibok.wfMsg('wikibok-new-element','description','button','text'),
					title: $.wikibok.wfMsg('wikibok-new-element','description','button','title'),
					class: $.wikibok.wfMsg('wikibok-new-element','description','button','class'),
					click: function() {
						var
							efunc,
							error = false,
							me = $(this),
							_title = (me.find('input.name').val()).replace(/ /g,'_'),
							_t = $.wikibok.getPageNamespace(_title)+':'+$.wikibok.getPageName(_title);
						//クライアントで分かるエラー
						if(_title == '') {
							//記事名称入力なし
							error = $.wikibok.wfMsg('wikibok-new-element','error','empty');
							efunc = function() {
								me.find('input.name').focus();
							}
						}
						else if(svg.allNode().filter(function(d){return d.name == _title;}).length > 0){
							//すでに作成済み
							error = $.wikibok.wfMsg('wikibok-new-element','error','already');
							efunc = function(t,b) {
								//対象ノードを強調・スクロール
								svg.actNode(_title);
								$.scrollTo($('g[data="'+_title+'"]'),100,{offset:{top:-150,left:-150}});
							}
						}
						if(error == false) {
						//記事がないので直接編集画面を開く
							$.wikibok.getDescriptionEdit(_t)
							.done(function(dat) {
								var
									page = dat.query.pages,
									token = $.map(page,function(d) {return d.edittoken;}).join(),
									timestamp = $.map(page,function(d) {return d.starttimestamp;}).join();
								me.dialog('close');
								//編集結果をAPIで反映してから,BOK-XMLへ反映する/しない
								$.wikibok.editDescriptionDialog(_t,'',{
									title : _t,
									token : token,
									basetimestamp : timestamp,
									createonly : true,
								})
								.done(function(res) {
									if(res) {
										//SVGデータ更新
										AfterDescriptionUpdate(_title);
									}
								});
							});
						}
						else {
							$.wikibok.timePopup(
								etitle,
								error,
								5000,
								efunc
							);
						}
					},
				};
			$.wikibok.exDialog(
				dtitle,
				tmp,
				{
					close: function(){
					},
					focus: function() {
						var
							me = $(this).dialog('widget');
						if(_open) {
							_open = false;
							me.setInterruptKeydown([{
								class : 'name',
								next : create_btn.class,
								prev : close_btn.class
							}]);
							$(this).find('input.name').val('');
						}
					},
					buttons : [create_btn,close_btn]
				}
			);
		});
	
/*
	//ドラッグした範囲のノード名を返却...
	$(document).InitDragDrop(function(a,b){
		var
			x0 = a.start[0],
			y0 = a.start[1],
			x1 = a.end[0],
			y1 = a.end[1],
			nodes = $.map(svg.allNode(),function(d) {
				if((x0 <= d.x && d.x <= x1) && (y0 <= d.y && d.y <= y1)) {
					return d.name
				}
			});
		if(nodes.length > 0) {
			alert(nodes.join('\n'));
		}
	});
*/
});
